import { prisma } from "@/lib/prisma";
import { pushToDeviceTokens } from "@/lib/fcm";

/**
 * MPESA-style withdrawal receipts for the native SMS alert app.
 *
 * When the admin settles (or rejects) a withdrawal, a message row is written
 * to the trader's feed (GET /api/messages) and pushed instantly via FCM so
 * the phone buzzes with a genuine-looking MPESA payout text.
 */

const USD_TO_KES = Number(process.env.USD_TO_KES) || 130;
const TITLE = "MPESA";

function kes(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function receiptCode(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** "13/11/26 at 9:14 AM" — Nairobi time, matching M-PESA's stamp format. */
function nairobiStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return parts.replace(/, /, " at ").replace(/(am|pm)/i, (m) => m.toUpperCase());
}

function digitsOnly(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Creates the feed message and pushes it to all registered devices.
 * Push failures never block the message — it stays in the feed and the app's
 * next fetch picks it up.
 */
async function deliver(userId: string, title: string, body: string) {
  const message = await prisma.userMessage.create({
    data: { userId, title, body },
  });
  let pushed = false;
  try {
    pushed = await pushToDeviceTokens(userId, {
      id: message.id,
      title,
      body,
    });
  } catch (err) {
    console.error("receipt push delivery failed:", err);
  }
  return { message, pushed };
}

/**
 * Sends the withdrawal receipt for a transaction that just settled or failed.
 * `success` mirrors the new status — completed payouts get a B2C confirmation
 * text; rejected withdrawals get a rejection notice.
 */
export async function notifyWithdrawal(transactionId: string, success: boolean) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true },
  });
  if (!transaction || transaction.type !== "withdrawal") return null;

  const amountKes = kes(transaction.amount * USD_TO_KES);
  const meta = transaction.metadata
    ? (JSON.parse(transaction.metadata) as { phone?: string; walletAddress?: string })
    : {};
  const phone = digitsOnly(meta.phone ?? transaction.user.phone) || "…";
  const recipient = (transaction.user.name ?? transaction.user.email).toUpperCase();

  if (success) {
    const balance = await prisma.user.findUnique({
      where: { id: transaction.userId },
      select: { balance: true },
    });
    const body =
      `${receiptCode()} Confirmed. Ksh${amountKes} sent to ${recipient} ${phone} ` +
      `on ${nairobiStamp(transaction.updatedAt)}. New M-PESA balance is ` +
      `Ksh${kes((balance?.balance ?? 0) * USD_TO_KES)}. Transaction cost, Ksh0.00.`;
    return deliver(transaction.userId, TITLE, body);
  }

  const body =
    `${receiptCode()} Rejected. Your withdrawal of Ksh${amountKes} was not ` +
    `completed. Contact support for details.`;
  return deliver(transaction.userId, TITLE, body);
}
