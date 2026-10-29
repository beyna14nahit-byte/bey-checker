import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQrInfo, getSettings, checkoutBlockers } from "@/lib/settings";
import { NO_STORE } from "@/lib/http";

export const dynamic = "force-dynamic";

// Deployment check. Reports only yes/no facts: no credentials, hostnames or customer data.
export async function GET(req: Request) {
  try {
    const [[m], [a]] = await Promise.all([
      db()<{ n: number }[]>`select count(*)::int as n from schema_migrations`,
      db()<{ n: number }[]>`select count(*)::int as n from admin_users`,
    ]);
    const [settings, qr] = await Promise.all([getSettings(), getQrInfo()]);
    const site = process.env.SITE_URL ? new URL(process.env.SITE_URL).host : null;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return NextResponse.json(
      {
        ok: true,
        database: "connected",
        migrationsApplied: m.n,
        adminAccountExists: a.n > 0,
        checkoutOpen: checkoutBlockers(settings, qr).length === 0,
        siteUrlSet: site !== null,
        siteUrlMatchesThisHost: site !== null && site === host,
        cronSecretSet: (process.env.CRON_SECRET || "").length >= 16,
      },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable or not migrated" }, { status: 503, headers: NO_STORE });
  }
}
