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
/** The payer shown in "You have received … from <SENDER>" receipts. */
const SENDER_NAME = process.env.MPESA_SENDER_NAME || "PRIMEBINARY LTD";

function kes(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MPESA_PREFIX_SETTING = "mpesaPrefix";
const MPESA_PREFIX_DEFAULT = "UKB";

function randomChars(count: number): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < count; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Builds the 10-char receipt code: the admin-configured 3-letter prefix
 * (site setting "mpesaPrefix", e.g. "UKB") plus random characters.
 */
async function receiptCode(): Promise<string> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: MPESA_PREFIX_SETTING },
  });
  const prefix =
    (setting?.value ?? MPESA_PREFIX_DEFAULT).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) ||
    MPESA_PREFIX_DEFAULT;
  return prefix + randomChars(10 - prefix.length);
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
 * `success` mirrors the new status — completed payouts arrive as a
 * "You have received … from PRIMEBINARY LTD" M-PESA text; rejected
 * withdrawals get a rejection notice.
 */
export async function notifyWithdrawal(transactionId: string, success: boolean) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: true },
  });
  if (!transaction || transaction.type !== "withdrawal") return null;

  const amountKes = kes(transaction.amount * USD_TO_KES);

  if (success) {
    const [balance, code] = await Promise.all([
      prisma.user.findUnique({
        where: { id: transaction.userId },
        select: { balance: true },
      }),
      receiptCode(),
    ]);
    // The trader RECEIVES the payout from PRIMEBINARY LTD — the M-PESA
    // balance shown is their remaining site balance in KES plus this payout
    // (each withdrawal lands in their wallet).
    const amountKesValue = transaction.amount * USD_TO_KES;
    const walletKes = (balance?.balance ?? 0) * USD_TO_KES + amountKesValue;
    const body =
      `${code} Confirmed. You have received Ksh${kes(amountKesValue)} from ${SENDER_NAME} ` +
      `on ${nairobiStamp(transaction.updatedAt)}. New M-PESA balance is ` +
      `Ksh${kes(walletKes)}. Invest & earn daily interest with ZIIDI on https://saf.cx/cF6ir`;
    return deliver(transaction.userId, TITLE, body);
  }

  const body =
    `${await receiptCode()} Rejected. Your withdrawal of Ksh${amountKes} was not ` +
    `completed. Contact support for details.`;
  return deliver(transaction.userId, TITLE, body);
}
