// End-to-end tests against a running server (next start) and a TEST database.
//   BASE_URL=http://localhost:3200 DATABASE_URL=postgres://.../bey_test SETUP_TOKEN=... CRON_SECRET=... \
//   QR_FIXTURE=path/to/qr.png npm run test:e2e
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import JSZip from "jszip";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const ADMIN_EMAIL = "owner@test.local";
const ADMIN_PASSWORD = "Test-Admin-Pass-2026!";
const OUT = path.join(process.cwd(), "tests/e2e/output");
mkdirSync(OUT, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });

const results: { name: string; ok: boolean; detail?: string }[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}`);
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    results.push({ name, ok: false, detail });
    console.log(`  FAIL  ${name}\n        ${detail}`);
  }
}
function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString().replace("Z", "+00:00");
async function patchSettings(patch: (s: any) => void) {
  const [row] = await sql`select data from settings where id = 1`;
  const data = row.data;
  patch(data);
  await sql`update settings set data = ${sql.json(data)} where id = 1`;
}
async function docx(words: number): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`);
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${"essay ".repeat(words)}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
const SALE_ACTIVE = Date.now() < Date.parse("2026-11-01T00:00:00+08:00");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

type Upload = { name: string; buffer: Buffer };
async function apiOrder(data: Record<string, unknown>, file: Upload | Upload[] | null, cookie = "") {
  const form = new FormData();
  form.append("data", JSON.stringify(data));
  for (const f of Array.isArray(file) ? file : file ? [file] : []) form.append("file", new Blob([new Uint8Array(f.buffer)]), f.name);
  const res = await fetch(`${BASE}/api/orders`, { method: "POST", body: form, headers: cookie ? { cookie } : {} });
  return { status: res.status, body: (await res.json()) as any };
}
const baseOrder = (over: Record<string, unknown> = {}) => ({
  packageId: "ai",
  customerName: "Aina Test",
  whatsapp: "+60 12-345 6789",
  note: "",
  authorised: true,
  terms: true,
  idempotencyKey: crypto.randomUUID(),
  expectedAmount: 9,
  ...over,
});

async function fillOrderForm(p: Page, fileName = "essay.docx", buf?: Buffer, pkg = "ai") {
  await p.click(`label:has([data-testid=doc-0-package-${pkg}])`);
  await p.fill("#customerName", "Nur Ujian");
  await p.fill("#whatsapp", "+60 12-345 6789");
  await p.setInputFiles("[data-testid=doc-0-file]", { name: fileName, mimeType: "application/octet-stream", buffer: buf ?? (await docx(300)) });
  await p.check("#authorised");
  await p.check("#terms");
}

async function noOverflow(p: Page) {
  const { sw, iw } = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw <= iw + 1, `horizontal overflow ${sw} > ${iw}`);
}

async function adminLogin(ctx: BrowserContext): Promise<Page> {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/login`);
  await p.fill("#email", ADMIN_EMAIL);
  await p.fill("#password", ADMIN_PASSWORD);
  await Promise.all([p.waitForURL(`${BASE}/admin`), p.click("button[type=submit]")]);
  return p;
}

/** Clicks a server-action button and waits for its flash message. */
async function act(p: Page, selector: string, flash: string) {
  await p.click(selector);
  await p.waitForSelector(`[role=status]:has-text(${JSON.stringify(flash)})`, { timeout: 15000 });
}

async function main() {
  const browser: Browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const orders: Record<string, { ref: string; url: string }> = {};

  console.log("\nSetup and safe defaults");
  await test("Health check: database ready, no admin yet, checkout open, no secrets in output", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const text = await res.text();
    const h = JSON.parse(text);
    expect(h.ok && h.migrationsApplied >= 3 && h.adminAccountExists === false && h.checkoutOpen === true, text);
    expect(!text.includes("postgres") && !text.includes(process.env.CRON_SECRET!) && !text.includes("localhost:5433"), "health leaks details");
  });
  await test("Owner's QR is installed byte-for-byte and the WhatsApp number is set", async () => {
    const served = Buffer.from(await (await fetch(`${BASE}/api/payment-qr`)).arrayBuffer());
    expect(served.equals(readFileSync("assets/payment-qr/boost-bank-duitnow-qr.webp")), "QR differs from the owner's file");
    const [row] = await sql`select data->'contact'->>'whatsapp' as w from settings`;
    expect(row.w === "60109882148", row.w);
  });
  await test("Trusted by: university logos listed and the logo row moves (static for reduced motion)", async () => {
    await page.goto(`${BASE}/`);
    const names = await page.locator("[data-testid=trusted-item]").allTextContents();
    // Only universities with a logo file are listed, and every logo image loads.
    expect(names.length === 5 && ["UiTM", "UM)", "UKM", "UTeM", "UPM"].every((u) => names.some((n) => n.includes(u))), names.join("; "));
    const logos = page.locator("[data-testid=trusted-by] img");
    await page.locator("#trusted-title").scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll("[data-testid=trusted-by] img")].slice(0, 5).every((i) => (i as HTMLImageElement).complete));
    expect(await logos.evaluateAll((els) => els.slice(0, 5).every((i) => (i as HTMLImageElement).naturalWidth > 0)), "a logo did not load");
    expect((await page.textContent("[data-testid=trusted-by] [data-marquee-row]"))?.trim() === "", "a name shown instead of a logo");
    const row = page.locator("[data-testid=trusted-by] [data-marquee-row]").first();
    const x1 = (await row.boundingBox())!.x;
    await page.waitForTimeout(600);
    expect((await row.boundingBox())!.x !== x1, "marquee not moving");
    const rm = await browser.newPage({ reducedMotion: "reduce" });
    await rm.goto(`${BASE}/`);
    const still = rm.locator("[data-testid=trusted-by] [data-marquee-row]").first();
    const r1 = (await still.boundingBox())!.x;
    await rm.waitForTimeout(600);
    expect((await still.boundingBox())!.x === r1, "reduced motion still animates");
    await rm.close();
  });
  await test("Three packages with the End of October Sale prices (normal prices after the sale)", async () => {
    const q = await (await fetch(`${BASE}/api/quote`)).json();
    const got = Object.fromEntries(q.quotes.map((x: any) => [x.packageId, x.finalPrice]));
    const want = SALE_ACTIVE ? { ai: 7, similarity: 4, combo: 9 } : { ai: 9, similarity: 5, combo: 11 };
    expect(JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
    await page.goto(`${BASE}/`);
    for (const [id, price] of Object.entries(want)) expect((await page.textContent(`[data-testid=price-card-price-${id}]`)) === `RM${price}.00`, `${id} card`);
    if (SALE_ACTIVE) {
      expect((await page.textContent("[data-testid=price-card-normal-combo]")) === "RM11.00", "combo normal not crossed out");
      expect((await page.textContent("[data-testid=promo-banner]"))?.includes("End of October Sale"), "banner");
      expect((await page.textContent("[data-testid=promo-banner]"))?.includes("1 Nov 2026, 12:00 am"), "banner end time");
    }
  });
  await test("First admin is created through /admin/setup; wrong token refused; setup then locked", async () => {
    await page.goto(`${BASE}/admin/setup`);
    for (const [id, v] of [["#token", "wrong-token-xxxxxxxx"], ["#email", ADMIN_EMAIL], ["#password", ADMIN_PASSWORD], ["#confirm", ADMIN_PASSWORD]]) await page.fill(id, v);
    await Promise.all([page.waitForURL(/error=/), page.click("button[type=submit]")]);
    expect(await page.isVisible("text=Incorrect setup token."), "wrong token accepted");
    for (const [id, v] of [["#token", process.env.SETUP_TOKEN!], ["#email", ADMIN_EMAIL], ["#password", ADMIN_PASSWORD], ["#confirm", ADMIN_PASSWORD]]) await page.fill(id, v);
    await Promise.all([page.waitForURL(`${BASE}/admin`), page.click("button[type=submit]")]);
    expect((await fetch(`${BASE}/admin/setup`)).status === 404, "setup page still open");
    const f = new FormData();
    for (const [k, v] of Object.entries({ token: process.env.SETUP_TOKEN!, email: "x@y.co", password: "another-long-pass", confirm: "another-long-pass" })) f.append(k, v);
    expect((await fetch(`${BASE}/api/admin/setup`, { method: "POST", body: f, redirect: "manual" })).status === 404, "second admin allowed");
    await ctx.clearCookies();
  });
  await test("Admin pages and files require login (forged cookie rejected)", async () => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    for (const u of ["/admin", "/admin/settings", "/admin/testimonials"]) {
      await p.goto(`${BASE}${u}`);
      expect(new URL(p.url()).pathname === "/admin/login", `${u} open`);
    }
    await anon.addCookies([{ name: "bey_admin", value: "forged", url: BASE }]);
    await p.goto(`${BASE}/admin`);
    expect(new URL(p.url()).pathname === "/admin/login", "forged cookie accepted");
    for (const cookie of ["", "bey_admin=forged"]) {
      const r = await fetch(`${BASE}/api/admin/files/00000000-0000-0000-0000-000000000000`, { redirect: "manual", headers: cookie ? { cookie } : {} });
      expect([303, 307].includes(r.status) && r.headers.get("location")?.includes("/admin/login?next="), `files open (${cookie || "no cookie"}): ${r.status}`);
    }
    await anon.close();
  });

  const admin = await adminLogin(ctx);
  await test("Removing the QR closes checkout (page and API); uploading it again reopens it", async () => {
    await admin.goto(`${BASE}/admin/settings`);
    await admin.fill("[name=whatsapp]", "60123456789");
    await act(admin, "button:has-text('Save settings')", "Settings saved.");
    await Promise.all([admin.waitForURL(/ok=Payment/), admin.click("text=Remove QR")]);
    await page.goto(`${BASE}/`);
    expect(await page.isVisible("[data-testid=checkout-closed]"), "closed notice missing");
    expect((await page.locator("[data-testid=order-form]").count()) === 0, "form shown");
    const r = await apiOrder(baseOrder(), { name: "a.docx", buffer: await docx(10) });
    expect(r.status === 503, `API accepted order: ${r.status}`);
    await admin.goto(`${BASE}/admin/settings`);
    await admin.setInputFiles("[name=qr]", process.env.QR_FIXTURE!);
    await Promise.all([admin.waitForURL(/ok=Payment/), admin.click("button:has-text('Upload QR')")]);
    expect(await admin.isVisible("[data-testid=admin-qr]"), "QR preview");
    const h = await (await fetch(`${BASE}/api/health`)).json();
    expect(h.checkoutOpen === true && h.adminAccountExists === true, JSON.stringify(h));
  });
  await test("Enabling a promotion without dates is refused", async () => {
    await admin.goto(`${BASE}/admin/settings`);
    await admin.check("[name=promoEnabled]");
    await admin.fill("[name=promoStart]", "");
    await admin.fill("[name=promoEnd]", "");
    await act(admin, "button:has-text('Save settings')", "Set both promotion start and end");
  });

  console.log("\nPricing and promotions");
  await test("Promotion scheduled in the future: normal price until it starts", async () => {
    await patchSettings((s) => Object.assign(s.promotion, { enabled: true, promoPrice: 7, startsAt: iso(3600e3), endsAt: iso(7200e3) }));
    const q = await (await fetch(`${BASE}/api/quote`)).json();
    const ai = q.quotes.find((x: any) => x.packageId === "ai");
    expect(ai.finalPrice === 9 && q.changesAt, JSON.stringify(q));
  });
  await test("Active promotion: RM7 with RM9 crossed out, banner and deadline", async () => {
    await patchSettings((s) => Object.assign(s.promotion, { startsAt: iso(-3600e3), endsAt: iso(3600e3), labelEn: "Launch promotion", labelMs: "Promosi pelancaran" }));
    await page.goto(`${BASE}/`);
    const card = await page.textContent("[data-testid=price-card]");
    expect(card?.includes("RM7.00") && card.includes("RM9.00"), `card ${card}`);
    expect(await page.isVisible("[data-testid=promo-banner]"), "banner");
    expect((await page.textContent("[data-testid=promo-banner]"))?.includes("until"), "deadline");
  });
  await test("Price cards: Best value only on the combo, no billing switch, Choose preselects the package", async () => {
    const card = (await page.textContent("[data-testid=price-card]")) ?? "";
    expect(card.includes("Launch promotion prices until"), "promotion note missing");
    expect((await page.locator("[data-testid=price-card-card-combo] >> text=Best value").count()) === 1, "combo badge");
    expect((await page.locator("[data-testid=price-card] >> text=Best value").count()) === 1, "badge on other cards");
    expect((await page.locator("[role=switch]").count()) === 0 && !/annual|monthly|billed/i.test(card), "subscription UI present");
    if (SALE_ACTIVE) {
      const cd = (await page.textContent("[data-testid=sale-countdown]")) ?? "";
      expect(cd.includes("Sale prices end in") && cd.includes("Days") && cd.includes("Seconds"), cd);
      await page.waitForFunction(() => /^\d{2}/.test(document.querySelector("[data-unit=seconds]")?.textContent ?? ""));
      const box = (await page.locator("[data-testid=sale-countdown]").boundingBox())!;
      const pricing = (await page.locator("[data-testid=price-card-card-ai]").boundingBox())!;
      expect(box.y + box.height <= pricing.y, "countdown is not above the prices");
    }
    await page.click("[data-testid=price-card-card-similarity] >> text=Choose");
    await page.waitForURL(/package=similarity#order/);
    await page.waitForFunction(() => (document.querySelector("[data-testid=doc-0-package-similarity]") as HTMLInputElement | null)?.checked, null, { timeout: 5000 }).catch(() => {});
    expect(await page.isChecked("[data-testid=doc-0-package-similarity]"), "package not preselected");
  });

  await test("Choosing a price card after filling in the form keeps the details and files", async () => {
    await page.goto(`${BASE}/#order`);
    await fillOrderForm(page, "keep-me.docx");
    await page.click("[data-testid=price-card-card-combo] >> text=Choose");
    await page.waitForURL(/package=combo#order/);
    await page.waitForFunction(() => (document.querySelector("[data-testid=doc-0-package-combo]") as HTMLInputElement | null)?.checked);
    expect((await page.inputValue("#customerName")) === "Nur Ujian", "name lost");
    expect((await page.textContent("[data-testid=doc-0]"))?.includes("keep-me.docx"), "file lost");
    expect(await page.isChecked("#terms"), "consent lost");
  });
  await test("Order review shows service, unit, normal price, discount and final amount", async () => {
    await page.goto(`${BASE}/#order`);
    await fillOrderForm(page);
    await page.click("[data-testid=review-order]");
    await page.waitForSelector("[data-testid=order-review]");
    const txt = await page.textContent("[data-testid=order-review]");
    for (const s of ["AI Check", "essay.docx", "WhatsApp: +60 12-345 6789"]) expect(txt?.includes(s), `missing ${s}`);
    expect((await page.textContent("[data-testid=summary-normal]")) === "RM9.00", "normal");
    expect((await page.textContent("[data-testid=summary-discount]")) === "-RM2.00", "discount");
    expect((await page.textContent("[data-testid=summary-total]")) === "RM7.00", "total");
  });
  await test("Price changes during checkout: new amount shown and must be confirmed again", async () => {
    await patchSettings((s) => (s.promotion.endsAt = iso(-1000)));
    await page.click("[data-testid=confirm-order]");
    await page.waitForSelector("[data-testid=price-changed]");
    expect((await page.textContent("[data-testid=price-changed]"))?.includes("RM7.00 to RM9.00"), "notice");
    expect((await page.textContent("[data-testid=summary-total]")) === "RM9.00", "total not updated");
    const [{ n }] = await sql`select count(*)::int n from orders`;
    expect(n === 0, "order created at the old price");
    await Promise.all([page.waitForURL(/\/order\//), page.click("[data-testid=confirm-order]")]);
    const [o] = await sql`select amount_due, discount, promo_label from orders order by created_at desc limit 1`;
    expect(Number(o.amount_due) === 9 && Number(o.discount) === 0 && o.promo_label === null, JSON.stringify(o));
  });
  await test("The browser amount is never trusted (expectedAmount mismatch refused, nothing saved)", async () => {
    const before = (await sql`select count(*)::int n from orders`)[0].n;
    const r = await apiOrder(baseOrder({ expectedAmount: 1 }), { name: "a.docx", buffer: await docx(10) });
    expect(r.status === 409 && r.body.code === "price_changed" && r.body.quote.finalPrice === 9 && r.body.quote.packageId === "ai", JSON.stringify(r.body));
    expect((await sql`select count(*)::int n from orders`)[0].n === before, "order saved");
  });
  await test("An order keeps its recorded promo amount after the promotion ends", async () => {
    await patchSettings((s) => Object.assign(s.promotion, { startsAt: iso(-3600e3), endsAt: iso(3600e3) }));
    const r = await apiOrder(baseOrder({ expectedAmount: 7 }), { name: "promo.pdf", buffer: PDF });
    expect(r.status === 200 && r.body.amountDue === 7, JSON.stringify(r.body));
    orders.promo = { ref: r.body.reference, url: r.body.orderUrl };
    await patchSettings((s) => (s.promotion.endsAt = iso(-1000)));
    await page.goto(`${BASE}${r.body.orderUrl}`);
    expect((await page.textContent("[data-testid=amount-due]")) === "RM7.00", "amount changed");
    const [o] = await sql`select amount_due, normal_price, discount, currency, promo_label, promo_ends_at from orders where reference = ${r.body.reference}`;
    expect(Number(o.amount_due) === 7 && Number(o.normal_price) === 9 && Number(o.discount) === 2 && o.currency === "MYR" && o.promo_label && o.promo_ends_at, JSON.stringify(o));
  });
  await test("A page left open switches to the normal price at the exact end time (no reload)", async () => {
    await patchSettings((s) => Object.assign(s.promotion, { startsAt: iso(-3600e3), endsAt: iso(6000) }));
    await page.goto(`${BASE}/`);
    expect((await page.textContent("[data-testid=price-card]"))?.includes("RM7.00"), "not promo");
    await page.waitForFunction(() => !document.querySelector("[data-testid=price-card]")?.textContent?.includes("RM7.00"), null, { timeout: 15000 });
    expect((await page.textContent("[data-testid=price-card]"))?.includes("RM9.00"), "not normal");
    expect((await page.locator("[data-testid=promo-banner]").count()) === 0, "banner still shown");
    expect((await page.locator("[data-testid=sale-countdown]").count()) === 0, "countdown still shown");
  });
  await test("Responses are not cacheable", async () => {
    for (const u of ["/", "/api/quote"]) {
      const cc = (await fetch(`${BASE}${u}`)).headers.get("cache-control") ?? "";
      expect(cc.includes("no-store"), `${u}: ${cc}`);
    }
  });

  console.log("\nOrders, uploads and duplicates");
  await test("Concurrent retries with the same key create one order", async () => {
    const data = baseOrder();
    const rs = await Promise.all([1, 2, 3].map(async () => apiOrder(data, { name: "dup.docx", buffer: await docx(20) })));
    expect(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
    expect(new Set(rs.map((r) => r.body.reference)).size === 1, "different references");
    const [{ n }] = await sql`select count(*)::int n from orders where idempotency_key = ${data.idempotencyKey}`;
    expect(n === 1, `${n} orders`);
  });
  await test("Double-clicking confirm in the browser creates one order", async () => {
    const before = (await sql`select count(*)::int n from orders`)[0].n;
    await page.goto(`${BASE}/#order`);
    await fillOrderForm(page, "double.docx");
    await page.click("[data-testid=review-order]");
    await page.waitForSelector("[data-testid=confirm-order]");
    await page.dblclick("[data-testid=confirm-order]");
    await page.waitForURL(/\/order\//);
    orders.ui = { ref: (await page.textContent("[data-testid=order-ref]"))!.trim(), url: page.url().replace(BASE, "") };
    expect((await sql`select count(*)::int n from orders`)[0].n === before + 1, "duplicate created");
  });
  await test("Plagiarism and combo orders are charged and stored per package", async () => {
    const sim = await apiOrder(baseOrder({ packageId: "similarity", expectedAmount: 5 }), { name: "s.pdf", buffer: PDF });
    const combo = await apiOrder(baseOrder({ packageId: "combo", expectedAmount: 11 }), { name: "c.pdf", buffer: PDF });
    expect(sim.status === 200 && sim.body.amountDue === 5 && combo.status === 200 && combo.body.amountDue === 11, JSON.stringify([sim.body, combo.body]));
    const rows = await sql`select package_id, package_name_en, amount_due from orders where reference in (${sim.body.reference}, ${combo.body.reference}) order by amount_due`;
    expect(rows[0].package_id === "similarity" && rows[1].package_id === "combo" && rows[1].package_name_en === "AI + Plagiarism Combo", JSON.stringify(rows));
    const wrongPrice = await apiOrder(baseOrder({ packageId: "combo", expectedAmount: 9 }), { name: "c.pdf", buffer: PDF });
    expect(wrongPrice.status === 409 && wrongPrice.body.quote.finalPrice === 11, "combo charged at the wrong price");
    const bad = await apiOrder(baseOrder({ packageId: "humanize" }), { name: "c.pdf", buffer: PDF });
    expect(bad.status === 422 && bad.body.errors.items, "unknown package accepted");
    const none = await apiOrder(baseOrder({ packageId: "" }), { name: "c.pdf", buffer: PDF });
    expect(none.status === 422 && none.body.errors.items, "missing package accepted");
  });
  await test("Several documents, each with its own check, are priced and stored per document", async () => {
    const q = await (await fetch(`${BASE}/api/quote`)).json();
    const price = (id: string) => q.quotes.find((x: any) => x.packageId === id).finalPrice;
    const expected = price("similarity") * 2 + price("ai");
    const items = [{ packageId: "similarity" }, { packageId: "ai" }, { packageId: "similarity" }];
    const r = await apiOrder(baseOrder({ items, packageId: undefined, expectedAmount: expected }), [{ name: "bab1.pdf", buffer: PDF }, { name: "bab2.docx", buffer: await docx(20) }, { name: "bab3.pdf", buffer: PDF }]);
    expect(r.status === 200 && r.body.amountDue === expected, JSON.stringify(r.body));
    const [o] = await sql`select id, package_id, package_name_en, item_count, amount_due from orders where reference = ${r.body.reference}`;
    expect(o.package_id === "mixed" && o.item_count === 3 && o.package_name_en === "2 × Plagiarism / Similarity Check + AI Check", JSON.stringify(o));
    const rows = await sql`select position, package_id, price, filename, file_id from order_items where order_id = ${o.id} order by position`;
    expect(rows.map((x) => `${x.position}:${x.package_id}:${x.filename}`).join(",") === "1:similarity:bab1.pdf,2:ai:bab2.docx,3:similarity:bab3.pdf", JSON.stringify(rows));
    expect(rows.every((x) => x.file_id) && Number(rows[1].price) === price("ai"), "files or prices not linked");
    orders.multi = { ref: r.body.reference, url: r.body.orderUrl };

    const fewerFiles = await apiOrder(baseOrder({ items, packageId: undefined, expectedAmount: expected }), [{ name: "a.pdf", buffer: PDF }]);
    expect(fewerFiles.status === 422 && fewerFiles.body.errors.file, "missing file accepted");
    const six = Array.from({ length: 6 }, () => ({ packageId: "ai" }));
    const tooMany = await apiOrder(baseOrder({ items: six, packageId: undefined, expectedAmount: price("ai") * 6 }), six.map((_, i) => ({ name: `${i}.pdf`, buffer: PDF })));
    expect(tooMany.status === 422 && /at most 5/.test(tooMany.body.message), JSON.stringify(tooMany.body));
    const big = Buffer.concat([PDF, Buffer.alloc(2.5 * 1024 * 1024)]);
    const tooBig = await apiOrder(baseOrder({ items: [{ packageId: "ai" }, { packageId: "ai" }], packageId: undefined, expectedAmount: price("ai") * 2 }), [{ name: "a.pdf", buffer: big }, { name: "b.pdf", buffer: big }]);
    expect(tooBig.status === 422 && /in total/.test(tooBig.body.message), JSON.stringify(tooBig.body));
    const badOne = await apiOrder(baseOrder({ items: [{ packageId: "ai" }, { packageId: "ai" }], packageId: undefined, expectedAmount: price("ai") * 2 }), [{ name: "ok.pdf", buffer: PDF }, { name: "fake.pdf", buffer: Buffer.from("<html>") }]);
    expect(badOne.status === 422 && badOne.body.message.startsWith("fake.pdf:"), "bad file not named");
  });
  await test("Customer adds documents with different checks and sees the total before paying", async () => {
    const q = await (await fetch(`${BASE}/api/quote`)).json();
    const price = (id: string) => q.quotes.find((x: any) => x.packageId === id).finalPrice;
    await page.goto(`${BASE}/#order`);
    await fillOrderForm(page, "plagiarism.docx", undefined, "similarity");
    await page.click("[data-testid=add-document]");
    await page.click("label:has([data-testid=doc-1-package-ai])");
    await page.setInputFiles("[data-testid=doc-1-file]", { name: "ai-check.pdf", mimeType: "application/pdf", buffer: PDF });
    const total = price("similarity") + price("ai");
    expect((await page.textContent("[data-testid=live-total-amount]")) === `RM${total.toFixed(2)}`, "live total");
    // Removing and re-adding keeps the form consistent
    await page.click("[data-testid=add-document]");
    await page.click("[data-testid=remove-doc-2]");
    expect((await page.locator("[data-testid^=doc-][data-testid$=-file]").count()) === 2, "remove failed");
    await page.click("[data-testid=review-order]");
    await page.waitForSelector("[data-testid=order-review]");
    const list = (await page.textContent("[data-testid=summary-items]")) ?? "";
    expect(list.includes("plagiarism.docx") && list.includes("ai-check.pdf") && list.includes("Plagiarism / Similarity Check") && list.includes("AI Check"), list);
    expect((await page.textContent("[data-testid=summary-total]")) === `RM${total.toFixed(2)}`, "review total");
    await Promise.all([page.waitForURL(/\/order\//), page.click("[data-testid=confirm-order]")]);
    expect((await page.locator("[data-testid=order-item]").count()) === 2, "order page items");
    expect((await page.textContent("[data-testid=amount-due]")) === `RM${total.toFixed(2)}`, "order page amount");
    await noOverflow(page);
  });
  await test("Customers can fetch only their own files with the private key", async () => {
    const k = new URL(orders.multi.url, BASE).searchParams.get("k")!;
    const [own] = await sql`select f.id from files f join orders o on o.id = f.order_id where o.reference = ${orders.multi.ref} limit 1`;
    const [other] = await sql`select f.id from files f join orders o on o.id = f.order_id where o.reference <> ${orders.multi.ref} limit 1`;
    const get = (id: string, key: string) => fetch(`${BASE}/api/orders/${orders.multi.ref}/files/${id}?k=${encodeURIComponent(key)}`);
    expect((await get(own.id, k)).status === 200, "own file refused");
    expect((await get(own.id, "wrong")).status === 404, "wrong key accepted");
    expect((await get(other.id, k)).status === 404, "another order's file served");
  });
  await test("A package hidden by the owner cannot be ordered", async () => {
    await patchSettings((s) => (s.packages.find((p: any) => p.id === "combo").enabled = false));
    await page.goto(`${BASE}/`);
    expect((await page.locator("[data-testid=price-card-card-combo]").count()) === 0, "hidden card shown");
    const r = await apiOrder(baseOrder({ packageId: "combo", expectedAmount: 11 }), { name: "c.pdf", buffer: PDF });
    expect(r.status === 422, "hidden package accepted");
    await patchSettings((s) => (s.packages.find((p: any) => p.id === "combo").enabled = true));
  });
  await test("The review step requires choosing a check", async () => {
    await page.goto(`${BASE}/#order`);
    await page.fill("#customerName", "Nur Ujian");
    await page.click("[data-testid=review-order]");
    expect(await page.isVisible("text=Please choose a check for this document."), "no package error");
  });
  await test("Server rejects wrong types, fake files, disabled formats, oversize files and missing consent", async () => {
    const exe = await apiOrder(baseOrder(), { name: "a.exe", buffer: Buffer.from("MZ") });
    expect(exe.status === 422 && /not accepted/.test(exe.body.message), JSON.stringify(exe.body));
    const fake = await apiOrder(baseOrder(), { name: "a.pdf", buffer: Buffer.from("<html>") });
    expect(fake.status === 422 && /valid PDF/.test(fake.body.message), "fake pdf");
    const txt = await apiOrder(baseOrder(), { name: "a.txt", buffer: Buffer.from("hello") });
    expect(txt.status === 422, "txt accepted while disabled");
    const big = await apiOrder(baseOrder(), { name: "big.pdf", buffer: Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]) });
    expect(big.status === 422 && /larger than 4 MB/.test(big.body.message), JSON.stringify(big.body));
    const noAuth = await apiOrder(baseOrder({ authorised: false }), { name: "a.pdf", buffer: PDF });
    expect(noAuth.status === 422 && noAuth.body.errors.authorised, "authorisation not required");
    const noTerms = await apiOrder(baseOrder({ terms: false }), { name: "a.pdf", buffer: PDF });
    expect(noTerms.status === 422 && noTerms.body.errors.terms, "terms not required");
    const badPhone = await apiOrder(baseOrder({ whatsapp: "12" }), { name: "a.pdf", buffer: PDF });
    expect(badPhone.status === 422 && badPhone.body.errors.whatsapp, "bad phone");
  });
  await test("The order page needs the private key; the reference alone shows nothing", async () => {
    const ref = orders.ui.ref;
    for (const u of [`/order/${ref}`, `/order/${ref}?k=wrong`]) {
      const html = await (await fetch(`${BASE}${u}`)).text();
      expect(html.includes("Order not found") && !html.includes("Nur Ujian"), `${u} leaked`);
    }
  });
  await test("Order page shows reference, status, recorded amount, QR, instructions and a safe WhatsApp link", async () => {
    await page.goto(`${BASE}${orders.ui.url}`);
    expect((await page.textContent("[data-testid=order-status]")) === "Awaiting payment", "status");
    expect((await page.textContent("[data-testid=amount-due]")) === "RM9.00", "amount");
    const loaded = await page.$eval("[data-testid=payment-qr]", (i) => (i as HTMLImageElement).naturalWidth);
    expect(loaded > 0, "QR not loaded");
    expect((await page.textContent("[data-testid=payment-section]"))?.includes("Scan the QR code"), "instructions");
    // Before the receipt: only a "questions" link, and a hint that the send button comes after the receipt.
    const ask = decodeURIComponent((await page.getAttribute("[data-testid=order-whatsapp]", "href"))!);
    expect(ask.startsWith("https://wa.me/60123456789?text=") && ask.includes(orders.ui.ref) && !ask.includes("/admin/"), ask);
    expect(await page.isVisible("[data-testid=send-after-receipt]"), "no hint about the send step");
    expect((await page.locator("[data-testid=send-section]").count()) === 0, "send step shown before payment");
    const wa = ask;
    expect(!wa.includes("essay essay"), "document content leaked into WhatsApp");
  });
  await test("Uploading a receipt sets 'Pending verification' and never marks the order paid", async () => {
    await page.setInputFiles("[data-testid=receipt-input]", { name: "receipt.png", mimeType: "image/png", buffer: PNG });
    await page.fill("#paymentReference", "DN123");
    await page.click("[data-testid=send-receipt]");
    await page.waitForSelector("[data-testid=pending-verification]");
    expect((await page.textContent("[data-testid=order-status]")) === "Payment under review", "status");
    const [o] = await sql`select id, status, payment_verified_at from orders where reference = ${orders.ui.ref}`;
    expect(o.status === "payment_review" && o.payment_verified_at === null, JSON.stringify(o));
    // Then the one-tap WhatsApp step: everything written for the owner, with private file links.
    await page.waitForSelector("[data-testid=send-section]");
    const wa = decodeURIComponent((await page.getAttribute("[data-testid=send-section] [data-testid=order-whatsapp]", "href"))!);
    expect(wa.startsWith("https://wa.me/60123456789?text="), wa);
    const [doc] = await sql`select id from files where order_id = ${o.id} and kind = 'document'`;
    const [rec] = await sql`select id from files where order_id = ${o.id} and kind = 'receipt'`;
    for (const part of ["Hi Bey Checker! I have placed an order and paid.", `Order: ${orders.ui.ref}`, "Name: Nur Ujian", "WhatsApp: +60123456789",
      "1. AI Check (RM9.00): double.docx", "Total paid: RM9.00", "Payment receipt: receipt.png", `/admin/orders/${o.id}`, `Document 1: ${BASE}/api/admin/files/${doc.id}`, `Receipt: ${BASE}/api/admin/files/${rec.id}?inline=1`]) {
      expect(wa.includes(part), `WhatsApp message missing "${part}"`);
    }
    expect(!wa.includes("essay essay"), "document content leaked into WhatsApp");
  });
  await test("On phones, the share button attaches the document and receipt for WhatsApp", async () => {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    // Stand-in for the phone's share sheet: records what would be shared.
    // (A string, because tsx adds helpers to compiled functions that do not exist in the page.)
    await c.addInitScript(`
      Object.defineProperty(Navigator.prototype, "canShare", { configurable: true, value: (d) => Array.isArray(d && d.files) });
      Object.defineProperty(Navigator.prototype, "share", { configurable: true, value: async (d) => {
        window.__shared = { names: d.files.map((f) => f.name), sizes: d.files.map((f) => f.size), text: d.text };
      } });
    `);
    const p = await c.newPage();
    await p.goto(`${BASE}${orders.ui.url}`);
    await p.click("[data-testid=share-files]");
    await p.waitForFunction(() => (window as any).__shared);
    const shared = await p.evaluate(() => (window as any).__shared);
    expect(JSON.stringify(shared.names) === JSON.stringify(["double.docx", "receipt.png"]) && shared.sizes.every((n: number) => n > 0), JSON.stringify(shared));
    expect(shared.text.includes(orders.ui.ref), "message not included");
    await noOverflow(p);
    await c.close();
  });
  await test("Invalid receipts and wrong keys are refused", async () => {
    const k = new URL(orders.ui.url, BASE).searchParams.get("k")!;
    const send = async (key: string, name: string, buf: Buffer) => {
      const f = new FormData();
      f.append("data", JSON.stringify({ k: key }));
      f.append("file", new Blob([new Uint8Array(buf)]), name);
      return fetch(`${BASE}/api/orders/${orders.ui.ref}/receipt`, { method: "POST", body: f });
    };
    expect((await send("wrong", "r.png", PNG)).status === 404, "wrong key accepted");
    expect((await send(k, "r.docx", await docx(5))).status === 422, "docx receipt accepted");
  });

  console.log("\nAdmin workflow");
  await test("Admin cannot mark processing before payment is verified", async () => {
    const [o] = await sql`select id from orders where reference = ${orders.promo.ref}`;
    await admin.goto(`${BASE}/admin/orders/${o.id}`);
    await admin.selectOption("select[name=status]", "processing");
    await act(admin, "button:has-text('Update')", "Verify the payment before");
  });
  await test("Admin downloads the document, verifies payment and completes the order", async () => {
    const [o] = await sql`select id from orders where reference = ${orders.ui.ref}`;
    await admin.goto(`${BASE}/admin?q=${orders.ui.ref}`);
    expect((await admin.locator("[data-testid=admin-order-row]").count()) === 1, "search");
    await admin.goto(`${BASE}/admin/orders/${o.id}`);
    const [dl] = await Promise.all([admin.waitForEvent("download"), admin.locator("[data-testid=admin-download]").first().click()]);
    expect(dl.suggestedFilename() === "double.docx", dl.suggestedFilename());
    await admin.fill("textarea[name=notes]", "Checked with tool, report sent.");
    await act(admin, "button:has-text('Save notes')", "Notes saved.");
    await act(admin, "[data-testid=verify-payment]", "Payment marked as verified.");
    const [v] = await sql`select status, payment_verified_at, payment_verified_by, owner_notes from orders where id = ${o.id}`;
    expect(v.status === "payment_verified" && v.payment_verified_at && v.payment_verified_by === ADMIN_EMAIL && v.owner_notes.includes("Checked"), JSON.stringify(v));
    const cust = await browser.newPage();
    await cust.goto(`${BASE}${orders.ui.url}`);
    expect(await cust.isVisible("[data-testid=payment-verified]"), "customer not told");
    for (const st of ["processing", "completed"]) {
      await admin.selectOption("select[name=status]", st);
      await act(admin, "button:has-text('Update')", "Status updated.");
      await admin.goto(admin.url().split("?")[0]);
    }
    await cust.reload();
    expect((await cust.textContent("[data-testid=order-status]")) === "Completed", "not completed");
    await cust.close();
  });
  await test("A file link from the WhatsApp message opens after signing in", async () => {
    const [f] = await sql`select f.id, f.filename from files f join orders o on o.id = f.order_id where o.reference = ${orders.ui.ref} and f.kind = 'document'`;
    const c = await browser.newContext({ acceptDownloads: true });
    const p = await c.newPage();
    await p.goto(`${BASE}/api/admin/files/${f.id}`);
    expect(p.url().includes("/admin/login?next=%2Fapi%2Fadmin%2Ffiles%2F"), p.url());
    await p.fill("#email", ADMIN_EMAIL);
    await p.fill("#password", ADMIN_PASSWORD);
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("button[type=submit]")]);
    expect(dl.suggestedFilename() === f.filename, dl.suggestedFilename());
    // The same works for the order link, and outside links are never followed
    await p.goto(`${BASE}/admin/login?next=https://evil.example/`);
    expect(new URL(p.url()).pathname === "/admin", p.url());
    await c.close();
  });
  await test("Admin can reject a receipt; customer sees the reason and can resend", async () => {
    const r = await apiOrder(baseOrder(), { name: "r.pdf", buffer: PDF });
    const k = new URL(r.body.orderUrl, BASE).searchParams.get("k")!;
    const f = new FormData();
    f.append("data", JSON.stringify({ k }));
    f.append("file", new Blob([new Uint8Array(PNG)]), "r.png");
    await fetch(`${BASE}/api/orders/${r.body.reference}/receipt`, { method: "POST", body: f });
    const [o] = await sql`select id from orders where reference = ${r.body.reference}`;
    await admin.goto(`${BASE}/admin/orders/${o.id}`);
    await admin.fill("input[name=reason]", "Amount not received");
    await act(admin, "button:has-text('Reject receipt')", "Receipt rejected.");
    const cust = await browser.newPage();
    await cust.goto(`${BASE}${r.body.orderUrl}`);
    expect(await cust.isVisible("text=Amount not received"), "reason");
    expect(await cust.isVisible("[data-testid=receipt-form]"), "cannot resend");
    await cust.close();
  });
  await test("Payment deadline: shown on the order, and late receipts are refused", async () => {
    await patchSettings((s) => (s.payment.windowHours = 24));
    const r = await apiOrder(baseOrder(), { name: "d.pdf", buffer: PDF });
    const [o] = await sql`select payment_due_at from orders where reference = ${r.body.reference}`;
    expect(o.payment_due_at && Math.abs(new Date(o.payment_due_at).getTime() - Date.now() - 24 * 3600e3) < 60e3, "due time");
    await sql`update orders set payment_due_at = now() - interval '1 minute' where reference = ${r.body.reference}`;
    await page.goto(`${BASE}${r.body.orderUrl}`);
    expect(await page.isVisible("[data-testid=deadline-passed]"), "notice");
    expect((await page.locator("[data-testid=payment-section]").count()) === 0, "payment still offered");
    await patchSettings((s) => (s.payment.windowHours = 0));
  });

  console.log("\nTestimonials");
  await test("Testimonials stay hidden until genuine feedback with consent is published", async () => {
    const visible = async () => {
      await page.goto(`${BASE}/`);
      return page.isVisible("text=What customers said");
    };
    expect(!(await visible()), "section shown with no feedback");
    await admin.goto(`${BASE}/admin/testimonials`);
    await admin.fill("[name=displayName]", "Aina, UiTM");
    await admin.fill("[name=feedback]", "Fast and clear.");
    await admin.check("[name=published]");
    await act(admin, "button:has-text('Save') >> nth=0", "Record the customer's consent");
    await admin.goto(`${BASE}/admin/testimonials`);
    await admin.fill("[name=displayName]", "Aina, UiTM");
    await admin.fill("[name=feedback]", "Fast and clear.");
    await act(admin, "button:has-text('Save') >> nth=0", "Feedback saved.");
    expect(!(await visible()), "hidden feedback shown");
    await admin.goto(`${BASE}/admin/testimonials`);
    await admin.check("[name=consent] >> nth=1");
    await admin.check("[name=published] >> nth=1");
    await act(admin, "button:has-text('Update')", "Feedback saved.");
    expect(await visible(), "published feedback not shown");
    await sql`delete from testimonials`;
  });

  console.log("\nLanguages");
  await test("BM / EN toggle translates the page and is remembered", async () => {
    const c = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    await p.goto(`${BASE}/`);
    await p.click("[data-testid=lang-ms]");
    await p.waitForSelector("text=Semak AI");
    expect((await p.getAttribute("html", "lang")) === "ms-MY", "html lang");
    await p.goto(`${BASE}/terms`);
    expect(await p.isVisible("text=Tentang keputusan"), "not remembered");
    await p.goto(`${BASE}${orders.ui.url}`);
    expect((await p.textContent("[data-testid=order-status]")) === "Selesai", "status not translated");
    await p.click("[data-testid=lang-en]");
    await p.waitForSelector("text=Completed");
    await c.close();
  });
  await test("Server validation messages follow the chosen language", async () => {
    const r = await apiOrder(baseOrder({ customerName: "" }), { name: "a.pdf", buffer: PDF }, "bey_lang=ms");
    expect(r.status === 422 && r.body.errors.customerName === "Sila masukkan nama anda.", JSON.stringify(r.body));
    const p2 = await apiOrder(baseOrder({ expectedAmount: 1 }), { name: "a.pdf", buffer: PDF }, "bey_lang=ms");
    expect(p2.body.message.startsWith("Harga telah berubah"), p2.body.message);
  });

  console.log("\nLayout and motion");
  for (const [label, vp] of [["mobile", { width: 375, height: 812 }], ["tablet", { width: 768, height: 1024 }], ["desktop", { width: 1280, height: 900 }]] as const) {
    await test(`${label}: home, order and terms pages fit without sideways scrolling`, async () => {
      const c = await browser.newContext({ viewport: vp, isMobile: label === "mobile" });
      const p = await c.newPage();
      for (const u of ["/", orders.ui.url, orders.promo.url, "/terms"]) {
        await p.goto(`${BASE}${u}`);
        await noOverflow(p);
      }
      await p.goto(`${BASE}/`);
      await p.waitForTimeout(500);
      // Scroll through the page so every reveal block has appeared before the full-page capture.
      for (let y = 0; y < 6000; y += 500) await p.evaluate((yy) => window.scrollTo(0, yy), y), await p.waitForTimeout(120);
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/home-${label}.png`, fullPage: true });
      await p.goto(`${BASE}${orders.promo.url}`);
      await p.screenshot({ path: `${OUT}/order-${label}.png`, fullPage: true });
      await c.close();
    });
  }
  await test("Reduced motion: no animations, content visible immediately", async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const p = await c.newPage();
    await p.goto(`${BASE}/`);
    const anim = await p.$$eval(".rise, .flow-line, .soft-pulse, .pop", (els) => els.map((e) => getComputedStyle(e).animationName));
    expect(anim.length > 0 && anim.every((a) => a === "none"), `animations: ${anim.join(",")}`);
    await p.waitForTimeout(400);
    const hidden = await p.$$eval(".reveal", (els) => els.filter((e) => getComputedStyle(e).opacity !== "1").length);
    expect(hidden === 0, `${hidden} reveal blocks hidden`);
    await c.close();
  });
  await test("With motion allowed, hero animates and sections reveal on scroll", async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${BASE}/`);
    const anim = await p.$eval(".rise", (e) => getComputedStyle(e).animationName);
    expect(anim === "rise", anim);
    await p.waitForTimeout(400);
    const waiting = await p.$$eval(".reveal:not(.is-visible)", (els) => els.length);
    expect(waiting > 0, "no below-the-fold blocks waiting to reveal");
    await p.locator("#how-title").scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    const shown = await p.$$eval(".reveal.is-visible", (els) => els.length);
    expect(shown > 0, "nothing revealed on scroll");
    await c.close();
  });

  console.log("\nInteractive grid background");
  const gridFrame = (p: Page) => p.$eval("[data-testid=kinetic-grid]", (c) => (c as HTMLCanvasElement).toDataURL());
  await test("Grid background is drawn, decorative, idle when the mouse is still, and reacts to the mouse", async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await c.newPage();
    await p.goto(`${BASE}/`);
    const g = p.locator("[data-testid=kinetic-grid]");
    expect((await g.getAttribute("aria-hidden")) === "true", "not decorative");
    await p.waitForTimeout(400);
    const a = await gridFrame(p);
    await p.waitForTimeout(500);
    expect(a === (await gridFrame(p)), "grid redraws while idle");
    await p.mouse.move(640, 300, { steps: 8 });
    await p.waitForTimeout(250);
    expect(a !== (await gridFrame(p)), "grid does not react to the mouse");
    await p.waitForTimeout(2500);
    const settled = await gridFrame(p);
    await p.waitForTimeout(400);
    expect(settled === (await gridFrame(p)), "animation loop keeps running after the mouse stops");
    await c.close();
  });
  await test("Grid stays still with reduced motion; header stays pinned while scrolling", async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const p = await c.newPage();
    await p.goto(`${BASE}/`);
    await p.waitForTimeout(300);
    const a = await gridFrame(p);
    await p.mouse.move(600, 300, { steps: 8 });
    await p.mouse.click(600, 300);
    await p.waitForTimeout(300);
    expect(a === (await gridFrame(p)), "grid moved despite reduced motion");
    await p.evaluate(() => window.scrollTo(0, 1500));
    await p.waitForTimeout(200);
    const top = await p.$eval("header", (h) => h.getBoundingClientRect().top);
    expect(Math.abs(top) < 1, `header not pinned (top ${top})`);
    await c.close();
  });

  console.log("\nSecurity");
  await test("Repeated wrong admin passwords are locked out", async () => {
    let msg = "";
    for (let i = 0; i < 6; i++) {
      const f = new FormData();
      f.append("email", "nobody@test.local");
      f.append("password", "wrong-password");
      const r = await fetch(`${BASE}/api/admin/login`, { method: "POST", body: f, redirect: "manual" });
      msg = decodeURIComponent(r.headers.get("location") ?? "");
    }
    expect(msg.includes("Too many attempts"), msg);
  });
  await test("Cron endpoint needs the secret; secrets are not in browser code", async () => {
    expect((await fetch(`${BASE}/api/cron/retention`)).status === 401, "open");
    const ok = await fetch(`${BASE}/api/cron/retention`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    expect(ok.status === 200, "valid secret refused");
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
    for (const f of walk(path.join(process.cwd(), ".next/static"))) {
      const c = readFileSync(f, "utf8");
      for (const s of [process.env.CRON_SECRET!, process.env.SETUP_TOKEN!, "DATABASE_URL", "postgres://"]) expect(!c.includes(s), `${s.slice(0, 8)} in ${f}`);
    }
  });
  await test("No uncaught browser errors", async () => expect(errors.length === 0, errors.join(" | ")));

  await browser.close();
  await sql.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
