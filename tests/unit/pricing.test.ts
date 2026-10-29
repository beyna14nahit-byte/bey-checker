import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/config";
import { getQuotes, nextPriceChange, promotionWindowValid, quoteFor } from "@/lib/pricing";

const S = DEFAULT_SETTINGS;
const at = (iso: string) => new Date(iso);
const prices = (s: Settings, iso: string) => Object.fromEntries(getQuotes(s, at(iso)).map((q) => [q.packageId, q.finalPrice]));
const withPromo = (p: Partial<Settings["promotion"]>): Settings => ({ ...S, promotion: { ...S.promotion, ...p } });

describe("End of October 2026 sale (owner-confirmed defaults)", () => {
  it("three packages at sale prices during October: RM7, RM4, RM9", () => {
    expect(prices(S, "2026-10-29T21:00:00+08:00")).toEqual({ ai: 7, similarity: 4, combo: 9 });
  });
  it("still on sale at 31 Oct 2026 11:59:59.999 PM Malaysia time", () => {
    expect(prices(S, "2026-10-31T23:59:59.999+08:00")).toEqual({ ai: 7, similarity: 4, combo: 9 });
  });
  it("normal prices exactly at 1 Nov 2026 00:00 Malaysia time: RM9, RM5, RM11", () => {
    expect(prices(S, "2026-11-01T00:00:00+08:00")).toEqual({ ai: 9, similarity: 5, combo: 11 });
  });
  it("the end instant is 31 Oct 16:00:00 UTC", () => {
    expect(prices(S, "2026-10-31T15:59:59Z").ai).toBe(7);
    expect(prices(S, "2026-10-31T16:00:00Z").ai).toBe(9);
  });
  it("normal prices before the sale starts", () => {
    expect(prices(S, "2026-09-30T23:59:59+08:00")).toEqual({ ai: 9, similarity: 5, combo: 11 });
  });
  it("discounts and labels are reported per package", () => {
    const q = quoteFor(S, S.packages[2], at("2026-10-30T10:00:00+08:00"));
    expect(q.normalPrice).toBe(11);
    expect(q.discount).toBe(2);
    expect(q.promo?.labelEn).toBe("End of October Sale");
    expect(q.promo?.labelMs).toBe("Jualan Akhir Oktober");
  });
  it("tells pages when the price changes next", () => {
    expect(nextPriceChange(getQuotes(S, at("2026-10-30T10:00:00+08:00")))).toBe("2026-11-01T00:00:00+08:00");
    expect(nextPriceChange(getQuotes(S, at("2026-11-02T10:00:00+08:00")))).toBeNull();
  });
});

describe("rules", () => {
  it("disabled promotion: normal prices", () => {
    expect(prices(withPromo({ enabled: false }), "2026-10-29T12:00:00+08:00")).toEqual({ ai: 9, similarity: 5, combo: 11 });
  });
  it("invalid windows never discount", () => {
    expect(promotionWindowValid(withPromo({ endsAt: "" }).promotion)).toBe(false);
    expect(promotionWindowValid(withPromo({ endsAt: "2026-09-01T00:00:00+08:00" }).promotion)).toBe(false);
  });
  it("a package whose promo price is not lower keeps its normal price", () => {
    const s = { ...S, packages: S.packages.map((p) => (p.id === "ai" ? { ...p, promoPrice: 9 } : p)) };
    expect(prices(s, "2026-10-29T12:00:00+08:00")).toEqual({ ai: 9, similarity: 4, combo: 9 });
  });
  it("hidden packages are not offered", () => {
    const s = { ...S, packages: S.packages.map((p) => (p.id === "combo" ? { ...p, enabled: false } : p)) };
    expect(Object.keys(prices(s, "2026-10-29T12:00:00+08:00"))).toEqual(["ai", "similarity"]);
  });
});
