// Inserts the default settings only if none exist. It never overwrites settings saved in the
// admin dashboard, and it never installs a payment QR (the owner uploads it).
import "./env";
import { db } from "../src/lib/db";
import { DEFAULT_SETTINGS } from "../src/lib/config";

async function main() {
  const sql = db();
  const r = await sql`insert into settings (id, data) values (1, ${sql.json(DEFAULT_SETTINGS as never)}) on conflict (id) do nothing returning id`;
  console.log(r.length ? "Default settings written." : "Settings already exist; left unchanged.");
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
