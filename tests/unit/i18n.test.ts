import { describe, expect, it } from "vitest";
import { MS } from "@/lib/i18n-ms";
import { collectKeys } from "./i18n-keys";

describe("Bahasa Melayu translations", () => {
  const keys = collectKeys();
  it("finds the customer-facing strings", () => expect(keys.size).toBeGreaterThan(100));
  it("has a Bahasa Melayu entry for every string", () => {
    const missing = [...keys].filter((k) => !(k in MS));
    expect(missing, `Missing:\n${missing.join("\n")}`).toEqual([]);
  });
  it("keeps every {placeholder}", () => {
    const bad = [...keys].filter((k) => (k.match(/\{\w+\}/g) ?? []).sort().join() !== ((MS[k] ?? k).match(/\{\w+\}/g) ?? []).sort().join());
    expect(bad).toEqual([]);
  });
});
