/**
 * Lists all PayHero payment channels on the account so you can pick the
 * correct PAYHERO_CHANNEL_ID. Run from the smartdollarfx folder:
 *
 *   $env:PAYHERO_USERNAME="your-username"; $env:PAYHERO_PASSWORD="your-api-token"; node payhero-channels.js
 */
const axios = require("axios");

(async () => {
  const username = (process.env.PAYHERO_USERNAME || "").trim();
  const password = (process.env.PAYHERO_PASSWORD || "").trim();
  if (!username || !password) {
    console.error("Set PAYHERO_USERNAME and PAYHERO_PASSWORD env vars first.");
    process.exit(1);
  }
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const base = process.env.PAYHERO_BASE_URL || "https://backend.payhero.co.ke/api/v2";

  try {
    const res = await axios.get(`${base}/channels`, {
      headers: { Authorization: auth },
      validateStatus: () => true,
    });
    const rows = Array.isArray(res.data?.channels)
      ? res.data.channels
      : Array.isArray(res.data?.data?.channels)
        ? res.data.data.channels
        : Array.isArray(res.data)
          ? res.data
          : [];
    if (!rows.length) {
      console.log("HTTP", res.status, JSON.stringify(res.data).slice(0, 500));
      return;
    }
    console.log("Channels on this account:\n");
    for (const c of rows) {
      console.log(
        `id=${c.id}  ${c.label || c.channel_name || c.name || "?"}  ` +
        `type=${c.type || c.channel || "?"}  status=${c.status || "?"}  ` +
        `short=${c.short_code || c.paybill || c.till || "-"}`
      );
    }
  } catch (e) {
    console.error("Request failed:", e.message);
  }
})();
