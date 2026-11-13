import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SETTING_KEYS = [
  "minDeposit",
  "maxDeposit",
  "minWithdrawal",
  "maxWithdrawal",
  "demoInitialBalance",
] as const;

// String setting handled separately from the numeric SETTING_KEYS above:
// the first letters of M-Pesa receipt codes (e.g. "UKB0O5K0P2").
const MPESA_PREFIX_KEY = "mpesaPrefix";
const MPESA_PREFIX_DEFAULT = "UKB";

const DEFAULTS: Record<string, string> = {
  minDeposit: "5",
  maxDeposit: "10000",
  minWithdrawal: "100",
  maxWithdrawal: "150000",
  demoInitialBalance: "10000",
};

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "admin";
}

function parseSettings(rows: { key: string; value: string }[]) {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return SETTING_KEYS.reduce(
    (acc, key) => {
      acc[key] = Number(map.get(key) ?? DEFAULTS[key]);
      return acc;
    },
    {} as Record<string, number>
  );
}

async function loadMpesaPrefix(): Promise<string> {
  const row = await prisma.siteSetting.findUnique({ where: { key: MPESA_PREFIX_KEY } });
  return normalizePrefix(row?.value ?? MPESA_PREFIX_DEFAULT);
}

function normalizePrefix(raw: string): string {
  const letters = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
  return letters || MPESA_PREFIX_DEFAULT;
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: SETTING_KEYS as unknown as string[] } },
  });
  const mpesaPrefix = await loadMpesaPrefix();

  return NextResponse.json({
    settings: { ...parseSettings(rows), mpesaPrefix },
    defaults: DEFAULTS,
  });
}

export async function PATCH(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const errors: string[] = [];

    for (const key of SETTING_KEYS) {
      if (body[key] !== undefined) {
        const val = Number(body[key]);
        if (isNaN(val) || val < 0) {
          errors.push(`${key} must be a positive number`);
          continue;
        }
        await prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: String(val) },
          update: { value: String(val) },
        });
      }
    }

    if (typeof body.mpesaPrefix === "string") {
      const letters = body.mpesaPrefix.toUpperCase().replace(/[^A-Z]/g, "");
      if (letters.length < 1 || letters.length > 3) {
        errors.push("mpesaPrefix must be 1-3 letters (A-Z)");
      } else {
        await prisma.siteSetting.upsert({
          where: { key: MPESA_PREFIX_KEY },
          create: { key: MPESA_PREFIX_KEY, value: letters },
          update: { value: letters },
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: SETTING_KEYS as unknown as string[] } },
    });
    const mpesaPrefix = await loadMpesaPrefix();

    return NextResponse.json({
      settings: { ...parseSettings(rows), mpesaPrefix },
      message: "Settings updated",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
