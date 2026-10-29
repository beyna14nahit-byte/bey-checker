import type { Settings } from "./config";

// Pricing is always computed on the server from the saved settings and the server clock.
// The promotion applies from startsAt (inclusive) until endsAt (exclusive): at the exact end
// instant the normal price applies, with no cron job or manual edit needed.

export type Quote = {
  currency: "MYR";
  unit: "document";
  normalPrice: number;
  finalPrice: number;
  discount: number;
  promo: { labelEn: string; labelMs: string; endsAt: string } | null;
  /** When this quote stops being valid (promotion start or end), or null if it will not change. */
  changesAt: string | null;
};

const cents = (n: number) => Math.round(n * 100);

export function promotionIsValid(p: Settings["promotion"], normalPrice: number): boolean {
  const start = Date.parse(p.startsAt);
  const end = Date.parse(p.endsAt);
  return p.enabled && !Number.isNaN(start) && !Number.isNaN(end) && end > start && p.promoPrice > 0 && cents(p.promoPrice) < cents(normalPrice);
}

export function getQuote(s: Settings, now: Date = new Date()): Quote {
  const normal = s.pricing.normalPrice;
  const p = s.promotion;
  const base: Quote = { currency: "MYR", unit: "document", normalPrice: normal, finalPrice: normal, discount: 0, promo: null, changesAt: null };
  if (!promotionIsValid(p, normal)) return base;
  const t = now.getTime();
  const start = Date.parse(p.startsAt);
  const end = Date.parse(p.endsAt);
  if (t < start) return { ...base, changesAt: p.startsAt };
  if (t >= end) return base;
  return {
    ...base,
    finalPrice: p.promoPrice,
    discount: (cents(normal) - cents(p.promoPrice)) / 100,
    promo: { labelEn: p.labelEn, labelMs: p.labelMs, endsAt: p.endsAt },
    changesAt: p.endsAt,
  };
}

export function rm(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return `RM${v.toFixed(2)}`;
}

export function rmShort(n: number): string {
  return Number.isInteger(n) ? `RM${n}` : `RM${n.toFixed(2)}`;
}
