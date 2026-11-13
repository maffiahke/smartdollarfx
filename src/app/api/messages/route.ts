import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveUser } from "@/lib/identity";

/**
 * Withdrawal-receipt feed for the native SMS alert app.
 *
 * GET /api/messages?username=<identifier> — identity resolves server-side
 * exactly like the site's own login (email, display name, or phone digits in
 * any Kenyan normalisation). Responds 404 when the identity is unknown so the
 * app's auto-link probing simply tries the next candidate.
 */
export async function GET(req: Request) {
  const username = (new URL(req.url).searchParams.get("username") ?? "").trim();
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const user = await resolveUser(username);
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Newest-first take, reversed so the conversation renders oldest→newest
  // with the latest receipt last — what the app's inbox expects.
  const rows = await prisma.userMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      title: m.title,
      body: m.body,
      read: m.read,
      at: m.createdAt.toISOString(),
    })),
  });
}
