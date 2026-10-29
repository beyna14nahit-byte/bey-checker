import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = NextResponse.redirect(new URL("/admin/login", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
