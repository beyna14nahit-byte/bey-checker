import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "byc_admin";
const SESSION_HOURS = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(adminId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await db()`insert into admin_sessions (token_hash, admin_id, expires_at) values (${sha256(token)}, ${adminId}, ${expires})`;
  await db()`delete from admin_sessions where expires_at < now()`;
  return { token, expires };
}

export async function destroySession(token: string): Promise<void> {
  await db()`delete from admin_sessions where token_hash = ${sha256(token)}`;
}

export type Admin = { id: string; email: string };

export async function getAdminFromToken(token: string | undefined): Promise<Admin | null> {
  if (!token) return null;
  const rows = await db()<Admin[]>`
    select u.id, u.email from admin_sessions s join admin_users u on u.id = s.admin_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return rows[0] ?? null;
}

export async function currentAdmin(): Promise<Admin | null> {
  const store = await cookies();
  return getAdminFromToken(store.get(SESSION_COOKIE)?.value);
}

/** For server components and server actions: redirects to the login page when not signed in. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
