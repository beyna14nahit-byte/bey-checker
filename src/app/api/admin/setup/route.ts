import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { setupTokenConfigured } from "@/lib/setup";
import { clientIp, consume } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const back = (msg: string) => NextResponse.redirect(new URL(`/admin/setup?error=${encodeURIComponent(msg)}`, req.url), 303);
  if (!setupTokenConfigured()) return new Response("Not found", { status: 404 });
  if (!(await consume("setup", clientIp(req)))) return back("Too many attempts. Please wait 15 minutes.");
  const form = await req.formData();
  const token = String(form.get("token") || "");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const expected = process.env.SETUP_TOKEN!;
  if (token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return back("Incorrect setup token.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return back("Please enter a valid email.");
  if (password.length < 12) return back("Password must be at least 12 characters.");
  if (password !== String(form.get("confirm") || "")) return back("Passwords do not match.");

  const hash = await hashPassword(password);
  const created = await db().begin(async (tx) => {
    // Serialise concurrent attempts so only one first admin can ever be created.
    await tx`lock table admin_users in share row exclusive mode`;
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from admin_users`;
    if (n > 0) return null;
    const [row] = await tx<{ id: string }[]>`insert into admin_users (email, password_hash) values (${email}, ${hash}) returning id`;
    return row;
  });
  if (!created) return new Response("Not found", { status: 404 });
  const { token: session, expires } = await createSession(created.id);
  const res = NextResponse.redirect(new URL("/admin", req.url), 303);
  res.cookies.set(SESSION_COOKIE, session, { httpOnly: true, sameSite: "lax", secure: new URL(req.url).protocol === "https:", path: "/", expires });
  return res;
}
