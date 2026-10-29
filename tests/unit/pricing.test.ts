import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/config";
import { getQuote, promotionIsValid } from "@/lib/pricing";

const withPromo = (p: Partial<Settings["promotion"]> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  promotion: { ...DEFAULT_SETTINGS.promotion, enabled: true, startsAt: "2026-11-01T00:00:00+08:00", endsAt: "2026-11-30T23:59:00+08:00", ...p },
});
const at = (iso: string) => new Date(iso);

describe("default settings", () => {
  it("charge the normal RM9 with no promotion (old October deadline is not reused)", () => {
    const q = getQuote(DEFAULT_SETTINGS, at("2026-10-15T12:00:00+08:00"));
    expect(DEFAULT_SETTINGS.promotion.enabled).toBe(false);
    expect(DEFAULT_SETTINGS.promotion.endsAt).toBe("");
    expect(q.finalPrice).toBe(9);
    expect(q.promo).toBeNull();
  });
});

describe("promotion boundaries (Malaysia time)", () => {
  const s = withPromo();
  it("before the start: normal price, and reports when it changes", () => {
    const q = getQuote(s, at("2026-10-31T23:59:59.999+08:00"));
    expect(q.finalPrice).toBe(9);
    expect(q.changesAt).toBe(s.promotion.startsAt);
  });
  it("exactly at the start: promo price", () => {
    const q = getQuote(s, at("2026-11-01T00:00:00+08:00"));
    expect(q.finalPrice).toBe(7);
    expect(q.discount).toBe(2);
    expect(q.normalPrice).toBe(9);
    expect(q.promo?.endsAt).toBe(s.promotion.endsAt);
  });
  it("one millisecond before the end: promo price", () => {
    expect(getQuote(s, at("2026-11-30T23:58:59.999+08:00")).finalPrice).toBe(7);
  });
  it("exactly at the end time: normal price", () => {
    const q = getQuote(s, at("2026-11-30T23:59:00+08:00"));
    expect(q.finalPrice).toBe(9);
    expect(q.promo).toBeNull();
    expect(q.discount).toBe(0);
  });
  it("end instant is the same moment in UTC (15:59:00Z)", () => {
    expect(getQuote(s, at("2026-11-30T15:58:59Z")).finalPrice).toBe(7);
    expect(getQuote(s, at("2026-11-30T15:59:00Z")).finalPrice).toBe(9);
  });
  it("after the end: normal price", () => expect(getQuote(s, at("2026-12-25T10:00:00+08:00")).finalPrice).toBe(9));
});

describe("invalid promotions never discount", () => {
  it("disabled", () => expect(getQuote(withPromo({ enabled: false }), at("2026-11-10T00:00:00+08:00")).finalPrice).toBe(9));
  it("missing dates", () => expect(promotionIsValid(withPromo({ endsAt: "" }).promotion, 9)).toBe(false));
  it("end before start", () => expect(promotionIsValid(withPromo({ endsAt: "2026-10-01T00:00:00+08:00" }).promotion, 9)).toBe(false));
  it("promo not cheaper", () => expect(getQuote(withPromo({ promoPrice: 9 }), at("2026-11-10T00:00:00+08:00")).finalPrice).toBe(9));
});
