import { db } from "./db";
import { DEFAULT_SETTINGS, type Settings } from "./config";

function merge<T>(base: T, override: unknown): T {
  if (Array.isArray(base) || typeof base !== "object" || base === null) {
    return (override === undefined ? base : override) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (override && typeof override === "object" && !Array.isArray(override)) {
    for (const [k, v] of Object.entries(override)) out[k] = k in out ? merge(out[k], v) : v;
  }
  return out as T;
}

export async function getSettings(): Promise<Settings> {
  const rows = await db()<{ data: unknown }[]>`select data from settings where id = 1`;
  return merge(DEFAULT_SETTINGS, rows[0]?.data);
}

export async function saveSettings(s: Settings): Promise<void> {
  await db()`insert into settings (id, data, updated_at) values (1, ${db().json(s as never)}, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()`;
}

export type QrInfo = { configured: boolean; version: string | null; filename: string | null; updatedAt: Date | null };

export async function getQrInfo(): Promise<QrInfo> {
  const rows = await db()<{ filename: string; sha256: string; updated_at: Date }[]>`
    select filename, sha256, updated_at from site_assets where key = 'payment_qr'`;
  const r = rows[0];
  return r ? { configured: true, version: r.sha256.slice(0, 12), filename: r.filename, updatedAt: r.updated_at } : { configured: false, version: null, filename: null, updatedAt: null };
}

/** Checkout is open only when customers can actually pay and be contacted. */
export function checkoutBlockers(s: Settings, qr: QrInfo): string[] {
  const b: string[] = [];
  if (!qr.configured) b.push("Payment QR not uploaded");
  if (!s.payment.instructionsEn.trim() || !s.payment.instructionsMs.trim()) b.push("Payment instructions missing");
  if (!s.contact.whatsapp) b.push("Contact WhatsApp number missing");
  if (!s.packages.some((p) => p.enabled && p.normalPrice > 0)) b.push("No package enabled");
  if (s.upload.formats.length === 0) b.push("No upload formats enabled");
  return b;
}
