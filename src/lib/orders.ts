import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { PACKAGE_IDS, type OrderStatus, type PackageId, type Settings } from "./config";
import { getQuotes, MAX_DOCUMENTS, priceBasket, type Basket } from "./pricing";
import { normalisePhone, validEmail } from "./contact";
import type { ValidFile } from "./files";
import { tEn, type Lang, type T } from "./i18n";
import { todayMy } from "./time";

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function makeReference(now: Date = new Date()): string {
  let code = "";
  for (let i = 0; i < 5; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `BEY-${todayMy(now).replace(/-/g, "").slice(2)}-${code}`;
}

export class ValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? "Please check the form.");
  }
}

/** The price changed between the customer's review and confirmation. */
export class PriceChangedError extends Error {
  constructor(public basket: Basket) {
    super("price_changed");
  }
}

export type OrderInput = {
  /** One package per document, in the same order as the uploaded files. */
  items: PackageId[];
  customerName: string;
  whatsapp: string;
  email: string | null;
  note: string;
  idempotencyKey: string;
  expectedAmount: number;
};

export function validateOrderInput(data: Record<string, unknown>, settings: Settings, fileCount: number, t: T = tEn): OrderInput {
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string).trim() : "");
  const errors: Record<string, string> = {};
  // Older pages (still open during a deploy) send a single packageId instead of items.
  const raw = Array.isArray(data.items) ? data.items : typeof data.packageId === "string" ? [{ packageId: data.packageId }] : [];
  const items = raw.map((x) => (x && typeof x === "object" ? String((x as { packageId?: unknown }).packageId ?? "") : "")) as PackageId[];
  const offered = new Set(getQuotes(settings).map((q) => q.packageId));
  if (items.length === 0 || items.some((id) => !PACKAGE_IDS.includes(id) || !offered.has(id))) errors.items = t("Please choose a check for each document.");
  else if (items.length > MAX_DOCUMENTS) errors.items = t("Please send at most {n} documents per order.", { n: MAX_DOCUMENTS });
  else if (fileCount !== items.length) errors.file = t("Please choose a file for each document.");
  const name = s("customerName");
  if (name.length < 2 || name.length > 100) errors.customerName = t("Please enter your name.");
  const phone = normalisePhone(s("whatsapp"));
  if (!phone) errors.whatsapp = t("Please enter a valid WhatsApp number with country code, e.g. +60 12-345 6789.");
  let email: string | null = null;
  if (settings.delivery.method === "email") {
    email = s("email").toLowerCase();
    if (!validEmail(email)) errors.email = t("Please enter a valid email address for report delivery.");
  }
  const note = s("note");
  if (note.length > 1000) errors.note = t("Please keep the note under 1,000 characters.");
  if (data.authorised !== true) errors.authorised = t("Please confirm that you are allowed to submit this document.");
  if (data.terms !== true) errors.terms = t("Please accept the service and privacy terms.");
  const key = s("idempotencyKey");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(key)) errors.form = t("Please reload the page and try again.");
  const expected = Number(data.expectedAmount);
  if (!Number.isFinite(expected)) errors.form = t("Please review the price and confirm again.");
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { items, customerName: name, whatsapp: phone!, email, note, idempotencyKey: key, expectedAmount: expected };
}

export type OrderRow = {
  id: string;
  reference: string;
  access_token: string;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
  customer_name: string;
  whatsapp: string;
  email: string | null;
  delivery_method: "whatsapp" | "email";
  note: string;
  lang: Lang;
  package_id: PackageId | "mixed";
  package_name_en: string;
  package_name_ms: string;
  item_count: number;
  currency: string;
  pricing_unit: string;
  normal_price: string;
  discount: string;
  amount_due: string;
  promo_label: string | null;
  promo_ends_at: Date | null;
  payment_due_at: Date | null;
  status: OrderStatus;
  receipt_uploaded_at: Date | null;
  payment_reference: string | null;
  payment_verified_at: Date | null;
  payment_verified_by: string | null;
  payment_rejected_at: Date | null;
  payment_rejection_reason: string | null;
  owner_notes: string;
  closed_at: Date | null;
};

async function findByKey(key: string) {
  const rows = await db()<{ reference: string; access_token: string; amount_due: string }[]>`
    select reference, access_token, amount_due from orders where idempotency_key = ${key}`;
  return rows[0] ?? null;
}

/** Summary name for the order list, e.g. "AI Check" or "2 × Plagiarism / Similarity Check + AI Check". */
export function basketName(b: Basket, lang: Lang): string {
  return b.lines.map((l) => `${l.count > 1 ? `${l.count} × ` : ""}${lang === "ms" ? l.quote.nameMs || l.quote.nameEn : l.quote.nameEn}`).join(" + ");
}

/**
 * Creates the order at the server's current prices. If the total differs from the amount the
 * customer reviewed, nothing is saved and PriceChangedError carries the new prices. A repeated
 * request with the same idempotency key returns the order already created.
 */
export async function createOrder(input: OrderInput, files: ValidFile[], settings: Settings, lang: Lang, now: Date = new Date()) {
  const existing = await findByKey(input.idempotencyKey);
  if (existing) return { ...existing, duplicate: true };

  const basket = priceBasket(getQuotes(settings, now), input.items);
  if (!basket || files.length !== basket.items.length) throw new ValidationError({ items: "Please choose a check for each document." });
  if (Math.round(basket.total * 100) !== Math.round(input.expectedAmount * 100)) throw new PriceChangedError(basket);

  const promo = basket.items.find((q) => q.promo)?.promo ?? null;
  const promoLabel = promo ? (lang === "ms" ? promo.labelMs : promo.labelEn) || promo.labelEn : null;
  const paymentDue = settings.payment.windowHours > 0 ? new Date(now.getTime() + settings.payment.windowHours * 3600e3) : null;
  const single = basket.lines.length === 1 ? basket.lines[0].quote.packageId : "mixed";
  const nameEn = basketName(basket, "en");
  const nameMs = basketName(basket, "ms");

  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = makeReference(now);
    const token = randomBytes(24).toString("base64url");
    try {
      const row = await db().begin(async (tx) => {
        const [o] = await tx<{ id: string; reference: string; access_token: string; amount_due: string }[]>`
          insert into orders (reference, access_token, idempotency_key, package_id, package_name_en, package_name_ms, item_count, customer_name, whatsapp, email, delivery_method,
            note, lang, currency, pricing_unit, normal_price, discount, amount_due, promo_label, promo_ends_at,
            payment_due_at, authorised_at, terms_accepted_at, created_at)
          values (${reference}, ${token}, ${input.idempotencyKey}, ${single}, ${nameEn}, ${nameMs}, ${basket.items.length}, ${input.customerName}, ${input.whatsapp}, ${input.email},
            ${settings.delivery.method}, ${input.note}, ${lang}, 'MYR', 'document', ${basket.normalTotal},
            ${basket.discountTotal}, ${basket.total}, ${promoLabel}, ${promo ? new Date(promo.endsAt) : null},
            ${paymentDue}, ${now}, ${now}, ${now})
          returning id, reference, access_token, amount_due`;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const q = basket.items[i];
          const [f] = await tx<{ id: string }[]>`insert into files (order_id, kind, filename, mime, size, sha256, data)
            values (${o.id}, 'document', ${file.filename}, ${file.mime}, ${file.size}, ${file.sha256}, ${file.data}) returning id`;
          await tx`insert into order_items (order_id, position, package_id, package_name_en, package_name_ms, normal_price, discount, price, file_id, filename)
            values (${o.id}, ${i + 1}, ${q.packageId}, ${q.nameEn}, ${q.nameMs}, ${q.normalPrice}, ${q.discount}, ${q.finalPrice}, ${f.id}, ${file.filename})`;
        }
        await tx`insert into events (order_id, actor, message) values (${o.id}, 'customer', ${`Order placed: ${nameEn}, MYR ${basket.total.toFixed(2)}.`})`;
        return o;
      });
      return { ...row, duplicate: false };
    } catch (e) {
      const err = e as { code?: string; constraint_name?: string };
      if (err.code === "23505") {
        // Same checkout submitted twice at once: return the order the other request created.
        if (err.constraint_name?.includes("idempotency")) {
          const again = await findByKey(input.idempotencyKey);
          if (again) return { ...again, duplicate: true };
        }
        continue; // reference collision: try another reference
      }
      throw e;
    }
  }
  throw new Error("Could not generate a unique order reference.");
}

export type OrderItem = {
  id: string;
  position: number;
  package_id: PackageId;
  package_name_en: string;
  package_name_ms: string;
  normal_price: string;
  discount: string;
  price: string;
  file_id: string | null;
  filename: string;
};

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return db()<OrderItem[]>`
    select id, position, package_id, package_name_en, package_name_ms, normal_price, discount, price, file_id, filename
    from order_items where order_id = ${orderId} order by position`;
}

export async function getOrderForCustomer(reference: string, token: string): Promise<OrderRow | null> {
  if (!reference || !token || token.length > 100) return null;
  const rows = await db()<OrderRow[]>`select * from orders where reference = ${reference}`;
  const o = rows[0];
  if (!o) return null;
  const a = Buffer.from(o.access_token);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b) ? o : null;
}

export function orderPath(reference: string, token: string): string {
  return `/order/${encodeURIComponent(reference)}?k=${encodeURIComponent(token)}`;
}

export function paymentDeadlinePassed(o: Pick<OrderRow, "payment_due_at">, now: Date = new Date()): boolean {
  return o.payment_due_at !== null && now.getTime() > new Date(o.payment_due_at).getTime();
}

/** A receipt can be sent while payment is outstanding and before any payment deadline. */
export function canUploadReceipt(o: Pick<OrderRow, "status" | "payment_due_at">, now: Date = new Date()): boolean {
  return (o.status === "awaiting_payment" || o.status === "payment_review") && !paymentDeadlinePassed(o, now);
}

export async function logEvent(orderId: string, actor: string, message: string) {
  await db()`insert into events (order_id, actor, message) values (${orderId}, ${actor}, ${message})`;
}
