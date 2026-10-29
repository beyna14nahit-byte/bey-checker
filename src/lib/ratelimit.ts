import { createHash } from "node:crypto";
import { db } from "./db";

export type Bucket = "order" | "quote" | "receipt" | "login_fail" | "setup";

const DEFAULTS: Record<Bucket, { limit: number; windowSec: number; env: string }> = {
  order: { limit: 20, windowSec: 3600, env: "RATE_LIMIT_ORDERS_PER_HOUR" },
  quote: { limit: 300, windowSec: 3600, env: "RATE_LIMIT_QUOTES_PER_HOUR" },
  receipt: { limit: 10, windowSec: 3600, env: "RATE_LIMIT_RECEIPTS_PER_HOUR" },
  login_fail: { limit: 5, windowSec: 900, env: "RATE_LIMIT_LOGIN_FAILURES" },
  setup: { limit: 5, windowSec: 900, env: "RATE_LIMIT_SETUP_ATTEMPTS" },
};

function config(bucket: Bucket) {
  const d = DEFAULTS[bucket];
  const override = Number(process.env[d.env]);
  return { limit: Number.isInteger(override) && override > 0 ? override : d.limit, windowSec: d.windowSec };
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

const hashKey = (bucket: Bucket, key: string) => createHash("sha256").update(`${bucket}|${key}`).digest("hex");

/** True when the key has already used up its allowance in the current window. */
export async function isLimited(bucket: Bucket, key: string): Promise<boolean> {
  const { limit, windowSec } = config(bucket);
  const [{ n }] = await db()<{ n: number }[]>`
    select count(*)::int as n from rate_limit_hits
    where bucket = ${bucket} and key_hash = ${hashKey(bucket, key)} and at > now() - make_interval(secs => ${windowSec})`;
  return n >= limit;
}

export async function recordHit(bucket: Bucket, key: string): Promise<void> {
  await db()`insert into rate_limit_hits (bucket, key_hash) values (${bucket}, ${hashKey(bucket, key)})`;
  if (Math.random() < 0.02) await db()`delete from rate_limit_hits where at < now() - interval '1 day'`;
}

export async function clearHits(bucket: Bucket, key: string): Promise<void> {
  await db()`delete from rate_limit_hits where bucket = ${bucket} and key_hash = ${hashKey(bucket, key)}`;
}

/** Counts this request and reports whether it is over the limit. */
export async function consume(bucket: Bucket, key: string): Promise<boolean> {
  if (await isLimited(bucket, key)) return false;
  await recordHit(bucket, key);
  return true;
}
