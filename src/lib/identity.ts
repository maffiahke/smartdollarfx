import { prisma } from "@/lib/prisma";

export type ResolvedUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

const SELECT = { id: true, email: true, name: true, phone: true } as const;

/**
 * Resolves a trader identity the same way the site's own login accepts:
 * email, display name, or phone digits.
 *
 * The native SMS alert app links by whatever the trader signs in with, and
 * for auto-link it probes the SIM number in several normalisations (bare
 * digits, national "0...", international "254..."). Every form is matched
 * here against the stored phone (digits at the end, e.g. "0759740294",
 * "+254759740294", "254759740294").
 *
 * Returns null when nothing resolves — callers respond 404 so the app keeps
 * probing other candidates.
 */
export async function resolveUser(identifier: string): Promise<ResolvedUser | null> {
  const value = identifier.trim();
  if (!value) return null;

  // 1) Email — the site's primary login identity.
  const byEmail = await prisma.user.findUnique({
    where: { email: value },
    select: SELECT,
  });
  if (byEmail) return byEmail;

  // 2) Display name (as shown on the site, e.g. "Jay Musa").
  const byName = await prisma.user.findFirst({
    where: { name: { equals: value, mode: "insensitive" } },
    select: SELECT,
  });
  if (byName) return byName;

  // 3) Phone digits in any Kenyan normalisation.
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 6) {
    const national = digits.length > 9 ? digits.slice(-9) : digits;
    const candidates = [national, `0${national}`, `254${national}`, `+254${national}`];
    const byPhone = await prisma.user.findFirst({
      where: { OR: candidates.map((phone) => ({ phone })) },
      select: SELECT,
    });
    if (byPhone) return byPhone;

    // Phone stored in any other format — match on the trailing national digits.
    const bySuffix = await prisma.user.findFirst({
      where: { phone: { not: null, endsWith: national } },
      select: SELECT,
    });
    if (bySuffix) return bySuffix;
  }

  return null;
}
