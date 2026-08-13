import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Seed default admin
  const adminEmail = "admin@smartdollarfx.com";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("Admin@123", 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: "Admin",
        role: "admin",
        balance: 0,
        demoBalance: 0,
      },
    });
    console.log("Default admin created: admin@smartdollarfx.com / Admin@123");
  } else {
    console.log("Admin already exists, skipping seed.");
  }

  // Seed default payment methods. The USDT address defaults to the
  // CRYPTO_USDT_ADDRESS env var and is stored in the database so the website
  // can serve it from there.
  const usdtAddress = process.env.CRYPTO_USDT_ADDRESS?.trim() || "";
  const methods = [
    { name: "payhero", label: "PayHero (M-Pesa)", config: JSON.stringify({ apiKey: "", phoneNumber: "" }) },
    {
      name: "usdt",
      label: "USDT (TRC-20)",
      config: JSON.stringify({ walletAddress: usdtAddress, network: "TRC-20" }),
    },
  ];
  for (const m of methods) {
    const existingMethod = await prisma.paymentMethod.findUnique({ where: { name: m.name } });
    if (!existingMethod) {
      await prisma.paymentMethod.create({ data: m });
      console.log(`Payment method created: ${m.name}`);
    } else if (m.name === "usdt" && usdtAddress) {
      // Keep the DB as the source of truth: backfill the address from the
      // env var so the website can serve it from the database even if the
      // record was created before the address was configured.
      const cfg = JSON.parse(existingMethod.config || "{}");
      if (!cfg.walletAddress) {
        cfg.walletAddress = usdtAddress;
        await prisma.paymentMethod.update({
          where: { name: "usdt" },
          data: { config: JSON.stringify(cfg) },
        });
        console.log("Backfilled USDT wallet address into database.");
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
