import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { purgeExpiredFiles } from "@/lib/retention";

export const dynamic = "force-dynamic";

// Daily clean-up (vercel.json). Called by Vercel Cron with "Authorization: Bearer <CRON_SECRET>".
// Pricing does NOT depend on this job: promotions start and end from the server clock.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const given = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  const ok = secret.length >= 16 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });
  await db()`delete from rate_limit_hits where at < now() - interval '1 day'`;
  const s = await getSettings();
  if (!s.retention.confirmed) return NextResponse.json({ ok: true, skipped: "Retention policy not confirmed." });
  return NextResponse.json({ ok: true, filesDeleted: await purgeExpiredFiles(s.retention.days, "scheduled job") });
}
