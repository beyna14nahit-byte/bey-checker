import { db } from "./db";

export async function adminCount(): Promise<number> {
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from admin_users`;
  return n;
}

/** First-admin setup is possible only while no administrator exists and SETUP_TOKEN is configured. */
export function setupTokenConfigured(): boolean {
  return (process.env.SETUP_TOKEN || "").length >= 16;
}
