"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ORDER_STATUSES, UPLOAD_FORMATS, type OrderStatus, type Package, type Settings, type UploadFormat } from "@/lib/config";
import { getSettings, saveSettings } from "@/lib/settings";
import { purgeExpiredFiles } from "@/lib/retention";
import { normalisePhone, validEmail } from "@/lib/contact";
import { myLocalToIso } from "@/lib/time";
import { hostLimitMb } from "@/lib/files";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function back(path: string, msg: string, tone: "ok" | "bad" = "ok"): never {
  const [p, hash] = path.split("#");
  redirect(`${p}${p.includes("?") ? "&" : "?"}${tone}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
}

async function event(orderId: string, actor: string, message: string) {
  await db()`insert into events (order_id, actor, message) values (${orderId}, ${actor}, ${message})`;
}

export async function verifyPayment(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const path = `/admin/orders/${id}`;
  const rows = await db()`update orders set status = 'payment_verified', payment_verified_at = now(), payment_verified_by = ${admin.email},
    payment_rejected_at = null, payment_rejection_reason = null, updated_at = now()
    where id = ${id} and status in ('awaiting_payment', 'payment_review') returning amount_due`;
  if (!rows.length) back(path, "Only orders awaiting payment or under review can be verified.", "bad");
  await event(id, admin.email, `Payment verified manually (RM${Number(rows[0].amount_due).toFixed(2)}).`);
  back(path, "Payment marked as verified.");
}

export async function rejectPayment(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const reason = str(form, "reason").slice(0, 200);
  const path = `/admin/orders/${id}`;
  if (!reason) back(path, "Give a short reason; the customer will see it.", "bad");
  const rows = await db()`update orders set status = 'awaiting_payment', payment_rejected_at = now(), payment_rejection_reason = ${reason},
    payment_verified_at = null, payment_verified_by = null, updated_at = now()
    where id = ${id} and status in ('payment_review', 'payment_verified') returning id`;
  if (!rows.length) back(path, "Only receipts under review or verified can be rejected.", "bad");
  await event(id, admin.email, `Payment receipt rejected: ${reason}`);
  back(path, "Receipt rejected. The customer can upload a new one.");
}

export async function updateStatus(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const status = str(form, "status") as OrderStatus;
  const path = `/admin/orders/${id}`;
  if (!ORDER_STATUSES.includes(status)) back(path, "Invalid status.", "bad");
  if (status === "payment_verified") back(path, 'Use "Verify payment" to confirm a payment.', "bad");
  const [o] = await db()<{ status: OrderStatus }[]>`select status from orders where id = ${id}`;
  if (!o) back("/admin", "Order not found.", "bad");
  if ((status === "processing" || status === "completed") && !["payment_verified", "processing", "completed"].includes(o.status)) {
    back(path, "Verify the payment before marking the order as processing or completed.", "bad");
  }
  const closing = status === "completed" || status === "cancelled";
  await db()`update orders set status = ${status}, updated_at = now(),
    closed_at = ${closing ? db()`coalesce(closed_at, now())` : null} where id = ${id}`;
  await event(id, admin.email, `Status changed to "${status}".`);
  back(path, "Status updated.");
}

export async function saveNotes(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  await db()`update orders set owner_notes = ${str(form, "notes").slice(0, 5000)}, updated_at = now() where id = ${id}`;
  await event(id, admin.email, "Private notes updated.");
  back(`/admin/orders/${id}`, "Notes saved.");
}

export async function deleteOrderFiles(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "id");
  if (str(form, "confirm") !== "DELETE") back(`/admin/orders/${id}`, "Type DELETE to confirm.", "bad");
  const rows = await db()`delete from files where order_id = ${id} returning id`;
  await event(id, admin.email, `${rows.length} file(s) deleted by administrator.`);
  back(`/admin/orders/${id}`, `${rows.length} file(s) deleted.`);
}

function money(v: string): number | null {
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

export async function saveSettingsAction(form: FormData) {
  await requireAdmin();
  const cur = await getSettings();
  const errors: string[] = [];

  const packages: Package[] = cur.packages.map((pk) => {
    const normal = money(str(form, `pkg_${pk.id}_normal`));
    const promo = money(str(form, `pkg_${pk.id}_promo`));
    const nameEn = str(form, `pkg_${pk.id}_nameEn`).slice(0, 60);
    const nameMs = str(form, `pkg_${pk.id}_nameMs`).slice(0, 60);
    if (normal === null) errors.push(`${pk.nameEn}: normal price must be a positive amount, e.g. 9 or 9.00.`);
    if (promo === null) errors.push(`${pk.nameEn}: promotional price must be a positive amount.`);
    else if (normal !== null && promo > normal) errors.push(`${pk.nameEn}: promotional price cannot be higher than the normal price.`);
    if (!nameEn || !nameMs) errors.push(`${pk.nameEn}: names are required in both languages.`);
    return { ...pk, enabled: form.get(`pkg_${pk.id}_enabled`) === "on", nameEn: nameEn || pk.nameEn, nameMs: nameMs || pk.nameMs, normalPrice: normal ?? pk.normalPrice, promoPrice: promo ?? pk.promoPrice };
  });
  if (!packages.some((p) => p.enabled)) errors.push("Offer at least one package.");
  const enabled = form.get("promoEnabled") === "on";
  const startsAt = str(form, "promoStart") ? myLocalToIso(str(form, "promoStart")) : "";
  const endsAt = str(form, "promoEnd") ? myLocalToIso(str(form, "promoEnd")) : "";
  if (startsAt === null || endsAt === null) errors.push("Promotion dates are not valid.");
  if (enabled) {
    if (!startsAt || !endsAt) errors.push("Set both promotion start and end before enabling it.");
    else if (Date.parse(endsAt) <= Date.parse(startsAt)) errors.push("Promotion end must be after its start.");
  }

  const whatsapp = str(form, "whatsapp") ? normalisePhone(str(form, "whatsapp")) : "";
  if (whatsapp === null) errors.push("WhatsApp number is not valid. Include the country code, e.g. 60123456789.");
  const email = str(form, "email");
  if (email && !validEmail(email)) errors.push("Contact email is not valid.");
  const telegram = str(form, "telegramUrl");
  if (telegram && !/^https:\/\/t\.me\/[A-Za-z0-9_]{3,}$/.test(telegram)) errors.push("Telegram link must look like https://t.me/username.");

  const method = str(form, "deliveryMethod");
  if (method !== "whatsapp" && method !== "email") errors.push("Choose a delivery method.");
  const formats = UPLOAD_FORMATS.filter((f) => form.get(`format_${f}`) === "on") as UploadFormat[];
  if (!formats.length) errors.push("Enable at least one document format.");
  const maxMb = Number(str(form, "maxMb"));
  if (!(maxMb > 0 && maxMb <= hostLimitMb())) errors.push(`Maximum file size must be between 0 and ${hostLimitMb()} MB (hosting limit).`);
  const windowHours = Number(str(form, "windowHours"));
  if (!Number.isInteger(windowHours) || windowHours < 0 || windowHours > 720) errors.push("Payment deadline must be 0 (none) to 720 hours.");
  const retentionDays = Number(str(form, "retentionDays"));
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) errors.push("Retention days must be 1 to 3650.");
  const instructionsEn = str(form, "instructionsEn");
  const instructionsMs = str(form, "instructionsMs");
  if (!instructionsEn || !instructionsMs) errors.push("Payment instructions are required in both languages.");

  if (errors.length) back("/admin/settings", errors.join(" "), "bad");

  const next: Settings = {
    ...cur,
    contact: { whatsapp: whatsapp ?? "", email, telegramUrl: telegram },
    packages,
    promotion: { enabled, labelEn: str(form, "promoLabelEn").slice(0, 60), labelMs: str(form, "promoLabelMs").slice(0, 60), startsAt: startsAt ?? "", endsAt: endsAt ?? "" },
    payment: { provider: str(form, "provider").slice(0, 60) || "DuitNow QR", instructionsEn: instructionsEn.slice(0, 2000), instructionsMs: instructionsMs.slice(0, 2000), windowHours },
    delivery: { method: method as "whatsapp" | "email", turnaroundEn: str(form, "turnaroundEn").slice(0, 120), turnaroundMs: str(form, "turnaroundMs").slice(0, 120) },
    upload: { formats, maxMb },
    retention: { days: retentionDays, confirmed: form.get("retentionConfirmed") === "on" },
    launch: { uploadRulesConfirmed: form.get("uploadRulesConfirmed") === "on" },
  };
  await saveSettings(next);
  back("/admin/settings", "Settings saved. The website uses them immediately.");
}

export async function runRetention() {
  const admin = await requireAdmin();
  const s = await getSettings();
  if (!s.retention.confirmed) back("/admin/settings", "Confirm the retention policy first.", "bad");
  const n = await purgeExpiredFiles(s.retention.days, admin.email);
  back("/admin/settings", `Retention run complete: ${n} file(s) deleted.`);
}

export async function saveTestimonial(form: FormData) {
  await requireAdmin();
  const id = str(form, "id");
  const name = str(form, "displayName").slice(0, 60);
  const feedback = str(form, "feedback").slice(0, 600);
  const ratingRaw = str(form, "rating");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const consent = form.get("consent") === "on";
  const published = form.get("published") === "on";
  if (!name || !feedback) back("/admin/testimonials", "Name and feedback are required.", "bad");
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) back("/admin/testimonials", "Rating must be 1 to 5.", "bad");
  if (published && !consent) back("/admin/testimonials", "Record the customer's consent before publishing.", "bad");
  if (id) {
    await db()`update testimonials set display_name = ${name}, feedback = ${feedback}, rating = ${rating}, consent_confirmed = ${consent}, published = ${published} where id = ${id}`;
  } else {
    await db()`insert into testimonials (display_name, feedback, rating, consent_confirmed, published) values (${name}, ${feedback}, ${rating}, ${consent}, ${published})`;
  }
  back("/admin/testimonials", "Feedback saved.");
}

export async function deleteTestimonial(form: FormData) {
  await requireAdmin();
  await db()`delete from testimonials where id = ${str(form, "id")}`;
  back("/admin/testimonials", "Feedback deleted.");
}
