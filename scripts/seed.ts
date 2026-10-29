// Inserts the default settings and the owner's payment QR only if they do not exist yet.
// It never overwrites settings or a QR saved in the admin dashboard.
import "./env";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { DEFAULT_SETTINGS } from "../src/lib/config";

const QR_FILE = "assets/payment-qr/boost-bank-duitnow-qr.webp";

async function main() {
  const sql = db();
  const r = await sql`insert into settings (id, data) values (1, ${sql.json(DEFAULT_SETTINGS as never)}) on conflict (id) do nothing returning id`;
  console.log(r.length ? "Default settings written." : "Settings already exist; left unchanged.");
  // One-time install: if the owner later removes the QR in the dashboard, it stays removed.
  const done = await sql`select 1 from schema_migrations where name = 'seed:payment_qr'`;
  if (!done.length && existsSync(QR_FILE)) {
    const data = readFileSync(QR_FILE);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const q = await sql`insert into site_assets (key, filename, mime, size, sha256, data)
      values ('payment_qr', 'boost-bank-duitnow-qr.webp', 'image/webp', ${data.length}, ${sha256}, ${data})
      on conflict (key) do nothing returning key`;
    await sql`insert into schema_migrations (name) values ('seed:payment_qr') on conflict do nothing`;
    console.log(q.length ? "Payment QR installed." : "Payment QR already set; left unchanged.");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
