import type { Package, PackageId, Settings } from "./config";

// Pricing is always computed on the server from the saved settings and the server clock.
// The promotion applies from startsAt (inclusive) until endsAt (exclusive): at the exact end
// instant the normal prices apply, with no cron job or manual edit needed.

export type Quote = {
  packageId: PackageId;
  nameEn: string;
  nameMs: string;
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

/** The promotion window itself is valid (enabled, both dates set, end after start). */
export function promotionWindowValid(p: Settings["promotion"]): boolean {
  const start = Date.parse(p.startsAt);
  const end = Date.parse(p.endsAt);
  return p.enabled && !Number.isNaN(start) && !Number.isNaN(end) && end > start;
}

/** A package has a real discount to apply during the promotion. */
export function packageHasPromo(pkg: Package): boolean {
  return pkg.promoPrice > 0 && cents(pkg.promoPrice) < cents(pkg.normalPrice);
}

export function enabledPackages(s: Settings): Package[] {
  return s.packages.filter((p) => p.enabled && p.normalPrice > 0);
}

export function quoteFor(s: Settings, pkg: Package, now: Date = new Date()): Quote {
  const base: Quote = {
    packageId: pkg.id,
    nameEn: pkg.nameEn,
    nameMs: pkg.nameMs,
    currency: "MYR",
    unit: "document",
    normalPrice: pkg.normalPrice,
    finalPrice: pkg.normalPrice,
    discount: 0,
    promo: null,
    changesAt: null,
  };
  const p = s.promotion;
  if (!promotionWindowValid(p) || !packageHasPromo(pkg)) return base;
  const t = now.getTime();
  if (t < Date.parse(p.startsAt)) return { ...base, changesAt: p.startsAt };
  if (t >= Date.parse(p.endsAt)) return base;
  return {
    ...base,
    finalPrice: pkg.promoPrice,
    discount: (cents(pkg.normalPrice) - cents(pkg.promoPrice)) / 100,
    promo: { labelEn: p.labelEn, labelMs: p.labelMs, endsAt: p.endsAt },
    changesAt: p.endsAt,
  };
}

/** Quotes for every package customers can order, in display order. */
export function getQuotes(s: Settings, now: Date = new Date()): Quote[] {
  return enabledPackages(s).map((pkg) => quoteFor(s, pkg, now));
}

/** The earliest moment any displayed price changes. */
export function nextPriceChange(quotes: Quote[]): string | null {
  const times = quotes.map((q) => q.changesAt).filter((x): x is string => !!x);
  return times.length ? times.sort((a, b) => Date.parse(a) - Date.parse(b))[0] : null;
}

export function packageName(q: { nameEn: string; nameMs: string }, lang: "en" | "ms"): string {
  return lang === "ms" ? q.nameMs || q.nameEn : q.nameEn;
}

export function rm(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  return `RM${v.toFixed(2)}`;
}

export function rmShort(n: number): string {
  return Number.isInteger(n) ? `RM${n}` : `RM${n.toFixed(2)}`;
}

/** Most documents one order can hold. All files travel in one upload, so the host limit covers their total size. */
export const MAX_DOCUMENTS = 5;

export type Basket = {
  items: Quote[];
  normalTotal: number;
  discountTotal: number;
  total: number;
  /** Packages in first-seen order with how many documents use each, e.g. 2 × similarity, 1 × ai. */
  lines: { quote: Quote; count: number; subtotal: number }[];
};

/** Prices a list of chosen packages (one per document) from the given quotes. Returns null if any package is unavailable. */
export function priceBasket(quotes: Quote[], packageIds: readonly string[]): Basket | null {
  const items: Quote[] = [];
  for (const id of packageIds) {
    const q = quotes.find((x) => x.packageId === id);
    if (!q) return null;
    items.push(q);
  }
  const sum = (f: (q: Quote) => number) => items.reduce((n, q) => n + cents(f(q)), 0) / 100;
  const lines: Basket["lines"] = [];
  for (const q of items) {
    const line = lines.find((l) => l.quote.packageId === q.packageId);
    if (line) line.count++;
    else lines.push({ quote: q, count: 1, subtotal: 0 });
  }
  for (const l of lines) l.subtotal = (cents(l.quote.finalPrice) * l.count) / 100;
  return { items, normalTotal: sum((q) => q.normalPrice), discountTotal: sum((q) => q.discount), total: sum((q) => q.finalPrice), lines };
}

/** The part of a basket the browser needs after a price change. */
export function basketForClient(b: Basket) {
  return { total: b.total, normalTotal: b.normalTotal, discountTotal: b.discountTotal, items: b.items };
}
