// Applies db/migrations/*.sql in order, once each. Safe to run on every deployment: an advisory
// lock stops two builds migrating at the same time, and applied files are recorded.
import "./env";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

async function main() {
  const sql = db();
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(424242)`;
    await tx`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const dir = path.join(process.cwd(), "db", "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      const done = await tx`select 1 from schema_migrations where name = ${file}`;
      if (done.length) continue;
      await tx.unsafe(readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
      console.log(`Applied ${file}`);
    }
  });
  console.log("Migrations up to date.");
  await sql.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
