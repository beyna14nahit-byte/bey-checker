import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __ashSql?: Sql };

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure the database.");
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) throw new Error("incomplete");
  } catch {
    // Never print the URL itself: it contains the password.
    throw new Error(
      "DATABASE_URL is not a valid connection string. Check that [YOUR-PASSWORD] was replaced, and URL-encode any @ # / ? : % characters in the password.",
    );
  }
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    idle_timeout: 20,
    onnotice: () => {},
  });
}

/** Lazily created so that builds without a database still succeed. */
export function db(): Sql {
  if (!globalForDb.__ashSql) globalForDb.__ashSql = createClient();
  return globalForDb.__ashSql;
}
