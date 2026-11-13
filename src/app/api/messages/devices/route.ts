import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUser } from "@/lib/identity";

/**
 * Device registration for instant push delivery — the native SMS alert app
 * binds its FCM token to the linked trader account here (POST, body:
 * { identifier, token }). Idempotent: upsert by token so token rotation and
 * re-registrations never duplicate rows.
 */
export async function POST(req: Request) {
  let body: { identifier?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!identifier || !token) {
    return NextResponse.json({ error: "identifier and token are required" }, { status: 400 });
  }

  const user = await resolveUser(identifier);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, userId: user.id },
    update: { userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
