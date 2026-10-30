import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/config";
import { getQuotes, priceBasket } from "@/lib/pricing";
import { ownerMessage } from "@/lib/order-message";
import type { OrderItem } from "@/lib/orders";

const sale = getQuotes(DEFAULT_SETTINGS, new Date("2026-10-30T12:00:00+08:00"));
const normal = getQuotes(DEFAULT_SETTINGS, new Date("2026-11-02T12:00:00+08:00"));

describe("several documents in one order", () => {
  it("two plagiarism checks and one AI check during the sale: 2 × RM4 + RM7 = RM15", () => {
    const b = priceBasket(sale, ["similarity", "ai", "similarity"])!;
    expect(b.total).toBe(15);
    expect(b.normalTotal).toBe(19);
    expect(b.discountTotal).toBe(4);
    expect(b.lines.map((l) => [l.quote.packageId, l.count, l.subtotal])).toEqual([["similarity", 2, 8], ["ai", 1, 7]]);
  });
  it("normal prices after the sale: RM5 + RM9 + RM11 = RM25", () => {
    expect(priceBasket(normal, ["similarity", "ai", "combo"])!.total).toBe(25);
  });
  it("an unknown or hidden package prices nothing", () => {
    expect(priceBasket(sale, ["ai", "humanize"])).toBeNull();
    const noCombo = getQuotes({ ...DEFAULT_SETTINGS, packages: DEFAULT_SETTINGS.packages.map((p) => (p.id === "combo" ? { ...p, enabled: false } : p)) });
    expect(priceBasket(noCombo, ["combo"])).toBeNull();
  });
  it("money adds up without floating point drift", () => {
    const q = sale.map((x) => ({ ...x, finalPrice: 0.1, normalPrice: 0.2, discount: 0.1 }));
    expect(priceBasket(q, ["ai", "ai", "ai"])!.total).toBe(0.3);
  });
});

describe("WhatsApp message to the owner", () => {
  const order = { id: "11111111-2222-3333-4444-555555555555", reference: "BEY-261030-ABCDE", customer_name: "Aisyah", whatsapp: "60123456789", email: null, amount_due: "11.00", note: "", lang: "ms" as const, status: "payment_review" as const };
  const item = (position: number, pkg: "ai" | "similarity", price: string, file: string | null, filename: string): OrderItem => ({
    id: `i${position}`, position, package_id: pkg, package_name_en: pkg === "ai" ? "AI Check" : "Plagiarism / Similarity Check", package_name_ms: pkg === "ai" ? "Semakan AI" : "Semakan Plagiarisme / Persamaan",
    normal_price: price, discount: "0", price, file_id: file, filename,
  });
  const items = [item(1, "similarity", "4.00", "f1", "bab1.docx"), item(2, "ai", "7.00", "f2", "bab2.pdf")];
  const msg = ownerMessage(order, items, { id: "r1", filename: "resit.jpg" }, "https://bey.example");

  it("says what was ordered and paid, in the customer's language", () => {
    expect(msg).toContain("Saya dah buat pesanan dan bayaran.");
    expect(msg).toContain("1. Semakan Plagiarisme / Persamaan (RM4.00): bab1.docx");
    expect(msg).toContain("2. Semakan AI (RM7.00): bab2.pdf");
    expect(msg).toContain("Jumlah dibayar: RM11.00");
    expect(msg).toContain("Resit bayaran: resit.jpg");
  });
  it("links the owner straight to the order and each file", () => {
    expect(msg).toContain("https://bey.example/admin/orders/11111111-2222-3333-4444-555555555555");
    expect(msg).toContain("Dokumen 1: https://bey.example/api/admin/files/f1");
    expect(msg).toContain("Dokumen 2: https://bey.example/api/admin/files/f2");
    expect(msg).toContain("Resit: https://bey.example/api/admin/files/r1?inline=1");
  });
  it("skips links to files that were deleted", () => {
    const m = ownerMessage({ ...order, lang: "en" }, [item(1, "ai", "7.00", null, "old.docx")], null, "https://bey.example");
    expect(m).toContain("1. AI Check (RM7.00): old.docx");
    expect(m).not.toContain("/api/admin/files/");
  });
});
