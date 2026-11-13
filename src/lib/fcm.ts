import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/prisma";

/**
 * Firebase Cloud Messaging sender for the native SMS alert app.
 *
 * The app (appsms) receives high-priority DATA messages shaped
 * { id, title, body } and surfaces them as MPESA-style heads-up alerts even
 * when the phone is locked / the process was killed. Credentials must belong
 * to the SAME Firebase project the app's google-services.json points at.
 */

type ServiceAccountLike = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function loadCredentials(): ServiceAccountLike | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const json = raw.trim().startsWith("{")
        ? raw
        : Buffer.from(raw, "base64").toString("utf8");
      const parsed = JSON.parse(json) as ServiceAccountLike & {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      return {
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: parsed.private_key ?? parsed.privateKey,
      };
    } catch (err) {
      console.error("FIREBASE_SERVICE_ACCOUNT is set but not valid JSON/base64:", err);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      // Vercel collapses "\n" newlines — restore them.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    };
  }

  return null;
}

function getFirebaseApp(): App | null {
  const credentials = loadCredentials();
  if (!credentials) return null;
  return getApps().length ? getApps()[0] : initializeApp({ credential: cert(credentials) });
}

export function isFcmConfigured(): boolean {
  return getFirebaseApp() !== null;
}

const isDeadToken = (code: string): boolean =>
  code.includes("registration-token-not-registered") ||
  code.includes("invalid-registration-token") ||
  code.includes("unregistered") ||
  code.includes("invalid-argument");

/**
 * Sends a data-only push to every device registered for the user. Dead /
 * rotated tokens are pruned so the token table stays clean. Returns true
 * when at least one push was accepted.
 */
export async function pushToDeviceTokens(
  userId: string,
  data: { id: string; title: string; body: string },
): Promise<boolean> {
  const app = getFirebaseApp();
  if (!app) return false;

  const tokens = (
    await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })
  ).map((row) => row.token);
  if (tokens.length === 0) return false;

  const messaging = getMessaging(app);
  const dead: string[] = [];
  let delivered = false;

  await Promise.all(
    tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          data: {
            id: data.id,
            title: data.title,
            body: data.body,
          },
          android: { priority: "high" },
        });
        delivered = true;
      } catch (err) {
        const code = String(
          (err as { errorInfo?: { code?: string } })?.errorInfo?.code ??
            (err as { code?: string })?.code ??
            "",
        );
        if (isDeadToken(code)) dead.push(token);
        else console.error(`FCM push failed for token ${token.slice(0, 8)}…:`, code || err);
      }
    }),
  );

  if (dead.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
  }
  return delivered;
}
