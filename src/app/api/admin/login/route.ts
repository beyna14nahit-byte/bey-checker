import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { clearHits, clientIp, isLimited, recordHit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const key = `${clientIp(req)}|${email}`;
  const fail = (msg: string) => NextResponse.redirect(new URL(`/admin/login?error=${encodeURIComponent(msg)}`, req.url), 303);

  if (await isLimited("login_fail", key)) return fail("Too many attempts. Please wait 15 minutes and try again.");
  const rows = await db()<{ id: string; password_hash: string }[]>`select id, password_hash from admin_users where email = ${email}`;
  const ok = rows[0] ? await verifyPassword(password, rows[0].password_hash) : false;
  if (!ok) {
    await recordHit("login_fail", key);
    return fail("Incorrect email or password.");
  }
  await clearHits("login_fail", key);
  const { token, expires } = await createSession(rows[0].id);
  await db()`update admin_users set last_login_at = now() where id = ${rows[0].id}`;
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    expires,
  });
  return res;
}
