"use client";

import { useRef, useState } from "react";
import { ArrowLeft, FileText, Loader2, Plus, X } from "lucide-react";
import { intlLocale, translator, type Lang } from "@/lib/i18n";
import type { PublicState } from "@/lib/public-state";
import { packageName, priceBasket, rm, type Basket, type Quote } from "@/lib/pricing";
import type { PackageId } from "@/lib/config";
import { formatMy } from "@/lib/time";
import { buttonClass } from "./ui/button";
import { Notice } from "./ui/card";
import { Field, ProgressBar } from "./fields";
import { postForm } from "./upload";

type Values = { customerName: string; whatsapp: string; email: string; note: string };
type Doc = { key: number; packageId: PackageId | null; file: File | null };

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`);

export function OrderForm({ initial, lang, initialPackage = null }: { initial: PublicState; lang: Lang; initialPackage?: PackageId | null }) {
  const t = translator(lang);
  const [state, setState] = useState(initial);
  const [values, setValues] = useState<Values>({ customerName: "", whatsapp: "", email: "", note: "" });
  const [docs, setDocs] = useState<Doc[]>([{ key: 1, packageId: initialPackage, file: null }]);
  const [authorised, setAuthorised] = useState(false);
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [basket, setBasket] = useState<Basket | null>(null);
  const [priceChange, setPriceChange] = useState<{ from: number; to: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  // One key per checkout: a double click or retry returns the same order instead of a duplicate.
  const key = useRef(newKey());
  const nextDocKey = useRef(2);

  const set = (k: keyof Values) => (v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const setDoc = (i: number, patch: Partial<Doc>) => setDocs((cur) => cur.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const email = state.deliveryMethod === "email";
  const accept = state.formats.map((f) => `.${f}`).join(",");
  const typesText = state.formats.map((f) => f.toUpperCase()).join(", ");
  const turnaround = lang === "ms" ? state.turnaroundMs || state.turnaroundEn : state.turnaroundEn;
  const totalBytes = docs.reduce((n, d) => n + (d.file?.size ?? 0), 0);
  // Live total while filling in the form (documents without a check yet are not counted).
  const live = priceBasket(state.quotes, docs.flatMap((d) => (d.packageId ? [d.packageId] : [])));

  function addDoc() {
    if (docs.length >= state.maxDocuments) return;
    const k = nextDocKey.current++;
    setDocs((cur) => [...cur, { key: k, packageId: cur[cur.length - 1]?.packageId ?? null, file: null }]);
    setTimeout(() => document.getElementById(`doc-${k}-file`)?.focus(), 0);
  }

  function checkLocally(): Record<string, string> {
    const e: Record<string, string> = {};
    docs.forEach((d, i) => {
      const id = `doc-${d.key}`;
      if (!d.packageId || !state.quotes.some((q) => q.packageId === d.packageId)) e[`${id}-package`] = t("Please choose a check for this document.");
      if (!d.file) e[`${id}-file`] = t("Please choose the file for document {n}.", { n: i + 1 });
      else {
        const ext = d.file.name.split(".").pop()?.toLowerCase() ?? "";
        if (!state.formats.includes(ext)) e[`${id}-file`] = t("This file type is not accepted. Accepted formats: {types}.", { types: typesText });
        else if (d.file.size > state.maxMb * 1024 * 1024) e[`${id}-file`] = t("The file is larger than {mb} MB.", { mb: state.maxMb });
        else if (d.file.size === 0) e[`${id}-file`] = t("The file is empty.");
      }
    });
    if (!Object.keys(e).length && totalBytes > state.totalMb * 1024 * 1024) e.files = t("Your files are larger than {mb} MB in total. Please send fewer or smaller files, or place a second order.", { mb: state.totalMb });
    if (values.customerName.trim().length < 2) e.customerName = t("Please enter your name.");
    if (values.whatsapp.replace(/\D/g, "").length < 9) e.whatsapp = t("Please enter a valid WhatsApp number with country code, e.g. +60 12-345 6789.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(values.email.trim())) e.email = t("Please enter a valid email address for report delivery.");
    if (!authorised) e.authorised = t("Please confirm that you are allowed to submit this document.");
    if (!terms) e.terms = t("Please accept the service and privacy terms.");
    return e;
  }

  function focusFirst(e: Record<string, string>) {
    const first = Object.keys(e)[0];
    const docPkg = first.match(/^doc-(\d+)-package$/);
    const target = docPkg ? `doc-${docPkg[1]}-package-${state.quotes[0]?.packageId}` : first === "files" ? `doc-${docs[0].key}-file` : first;
    document.getElementById(target)?.focus();
  }

  async function review() {
    setFormError("");
    const e = checkLocally();
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirst(e);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/quote", { cache: "no-store" });
      const body = await res.json();
      if (!body.ok || !body.checkoutOpen) {
        setFormError(t("Ordering is temporarily unavailable while we set up payments. Please check back soon."));
        return;
      }
      setState(body);
      const fresh = priceBasket(body.quotes as Quote[], docs.map((d) => d.packageId!));
      if (!fresh) {
        setErrors({ [`doc-${docs[0].key}-package`]: t("Please choose a check for this document.") });
        return;
      }
      setBasket(fresh);
      setPriceChange(null);
      setStep("review");
      window.scrollTo({ top: (document.getElementById("order")?.offsetTop ?? 0) - 70, behavior: "smooth" });
    } catch {
      setFormError(t("Network error. Please check your connection and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!basket || busy) return;
    setBusy(true);
    setFormError("");
    setProgress(0);
    const res = await postForm<{ orderUrl: string }>(
      "/api/orders",
      { ...values, items: docs.map((d) => ({ packageId: d.packageId })), authorised, terms, idempotencyKey: key.current, expectedAmount: basket.total },
      docs.map((d) => d.file!),
      setProgress,
      t,
    );
    setProgress(null);
    if (res.ok) {
      window.location.assign(res.orderUrl);
      return; // keep the button disabled while the order page loads
    }
    setBusy(false);
    if (res.code === "price_changed" && res.basket) {
      const updated = priceBasket(res.basket.items, docs.map((d) => d.packageId!));
      if (updated) {
        setPriceChange({ from: basket.total, to: updated.total });
        setBasket(updated);
        return;
      }
    }
    if (res.errors && Object.keys(res.errors).some((k) => k !== "form")) {
      // Server errors are about the documents as a whole or about a details field.
      const mapped: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.errors)) mapped[k === "items" || k === "file" ? "files" : k] = v;
      setErrors(mapped);
      setStep("form");
    }
    setFormError(res.message);
  }

  const promoLabel = (q: Quote) => (q.promo ? (lang === "ms" ? q.promo.labelMs : q.promo.labelEn) || q.promo.labelEn : "");

  if (step === "review" && basket) {
    const promo = basket.items.find((q) => q.promo) ?? null;
    const rows: [string, string, string?][] = [];
    if (basket.discountTotal > 0) {
      rows.push([t("Normal price"), rm(basket.normalTotal), "summary-normal"]);
      rows.push([t("{promo} discount", { promo: promoLabel(promo!) }), `-${rm(basket.discountTotal)}`, "summary-discount"]);
    }
    rows.push([t("Report delivery"), email ? t("Email: {email}", { email: values.email.trim() }) : t("WhatsApp: {number}", { number: values.whatsapp.trim() })]);
    if (turnaround) rows.push([t("Expected turnaround"), turnaround]);
    if (state.paymentWindowHours > 0) rows.push([t("Payment deadline"), t("Within {hours} hours of placing the order", { hours: state.paymentWindowHours })]);

    return (
      <div className="pop rounded-2xl border border-line bg-white p-5 sm:p-7" data-testid="order-review">
        <h3 className="text-xl font-bold">{t("Review your order")}</h3>
        {priceChange && (
          <Notice tone="warn" className="mt-4" role="alert" data-testid="price-changed">
            {t("The price changed from {from} to {to} while you were ordering. Please check the new amount and confirm again.", { from: rm(priceChange.from), to: rm(priceChange.to) })}
          </Notice>
        )}
        <ol className="mt-5 divide-y divide-line rounded-xl border border-line text-sm" data-testid="summary-items">
          {basket.items.map((q, i) => (
            <li key={docs[i].key} className="flex items-start justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="font-semibold">{packageName(q, lang)}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-muted"><FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">{docs[i].file?.name}</span></p>
              </div>
              <p className="shrink-0 text-right">
                <span className="font-semibold">{rm(q.finalPrice)}</span>
                {q.promo && <span className="block text-xs text-muted line-through">{rm(q.normalPrice)}</span>}
              </p>
            </li>
          ))}
        </ol>
        <dl className="mt-3 divide-y divide-line text-sm">
          {rows.map(([k, v, id]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right font-medium" data-testid={id}>{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <dt className="font-semibold">{basket.items.length > 1 ? t("Total for {n} documents", { n: basket.items.length }) : t("Total to pay")}</dt>
            <dd className="text-3xl font-extrabold tracking-tight" data-testid="summary-total">{rm(basket.total)}</dd>
          </div>
        </dl>
        {promo?.promo && (
          <p className="mt-2 text-right text-xs text-muted">{t("Promotion price valid until {date}.", { date: formatMy(promo.promo.endsAt, true, intlLocale(lang)) })}</p>
        )}
        <p className="mt-4 text-sm text-ink-soft">{t("After you confirm, you will get an order reference and the payment QR. Your payment stays pending until we verify it manually.")}</p>
        {formError && <p role="alert" className="mt-4 text-sm text-bad">{formError}</p>}
        {progress !== null && <div className="mt-4"><ProgressBar value={progress} label={t("Upload progress")} /></div>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button type="button" className={buttonClass("secondary")} onClick={() => setStep("form")} disabled={busy}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("Edit details")}
          </button>
          <button type="button" className={buttonClass("primary")} onClick={confirm} disabled={busy} data-testid="confirm-order">
            {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
            {busy ? t("Placing order...") : t("Confirm order · {amount}", { amount: rm(basket.total) })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5 rounded-2xl border border-line bg-white p-5 sm:p-7"
      data-testid="order-form"
      onSubmit={(e) => {
        e.preventDefault();
        review();
      }}
    >
      <fieldset className="space-y-3" data-testid="documents">
        <legend className="mb-1 text-sm font-medium">
          {t("Your documents")} <span className="text-bad" aria-hidden="true">*</span>
        </legend>
        <p className="text-xs text-muted">
          {t("Choose a check for each document. Accepted: {types}, up to {mb} MB each and {total} MB in total, up to {n} documents per order.", { types: typesText, mb: state.maxMb, total: state.totalMb, n: state.maxDocuments })}
        </p>
        {docs.map((d, i) => {
          const pkgError = errors[`doc-${d.key}-package`];
          const fileError = errors[`doc-${d.key}-file`];
          return (
            <div key={d.key} className={`rounded-xl border bg-paper p-4 ${pkgError || fileError ? "border-bad" : "border-line"}`} data-testid={`doc-${i}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{t("Document {n}", { n: i + 1 })}</p>
                {docs.length > 1 && (
                  <button type="button" onClick={() => setDocs((cur) => cur.filter((x) => x.key !== d.key))} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:bg-white hover:text-bad" data-testid={`remove-doc-${i}`}>
                    <X className="h-4 w-4" aria-hidden="true" /> {t("Remove")}
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("Check for document {n}", { n: i + 1 })} aria-invalid={pkgError ? true : undefined}>
                {state.quotes.map((q) => (
                  <label
                    key={q.packageId}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 transition-colors duration-200 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand sm:flex-col sm:items-start sm:justify-start ${d.packageId === q.packageId ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand/50"}`}
                  >
                    <input
                      id={`doc-${d.key}-package-${q.packageId}`}
                      type="radio"
                      name={`doc-${d.key}-package`}
                      value={q.packageId}
                      checked={d.packageId === q.packageId}
                      onChange={() => setDoc(i, { packageId: q.packageId })}
                      className="sr-only"
                      data-testid={`doc-${i}-package-${q.packageId}`}
                    />
                    <span className="text-sm font-medium">{packageName(q, lang)}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-sm font-bold">{rm(q.finalPrice)}</span>
                      {q.promo && <span className="text-xs text-muted line-through">{rm(q.normalPrice)}</span>}
                    </span>
                  </label>
                ))}
              </div>
              {pkgError && <p role="alert" className="mt-1 text-sm text-bad">{pkgError}</p>}
              <label htmlFor={`doc-${d.key}-file`} className="sr-only">{t("File for document {n}", { n: i + 1 })}</label>
              <input
                id={`doc-${d.key}-file`}
                type="file"
                accept={accept}
                onChange={(e) => setDoc(i, { file: e.target.files?.[0] ?? null })}
                className="mt-3 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-semibold file:text-brand-dark"
                aria-invalid={fileError ? true : undefined}
                data-testid={`doc-${i}-file`}
              />
              {d.file && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span className="min-w-0 truncate">{d.file.name}</span>
                  <span className="shrink-0 text-muted">({size(d.file.size)})</span>
                </p>
              )}
              {fileError && <p role="alert" className="mt-1 text-sm text-bad">{fileError}</p>}
            </div>
          );
        })}
        {errors.files && <p role="alert" className="text-sm text-bad">{errors.files}</p>}
        {docs.length < state.maxDocuments && (
          <button type="button" onClick={addDoc} className={`${buttonClass("secondary")} w-full`} data-testid="add-document">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("Add another document")}
          </button>
        )}
        {live && (
          <div className="rounded-xl bg-brand-soft/60 p-4 text-sm" data-testid="live-total" aria-live="polite">
            <ul className="space-y-1">
              {live.lines.map((l) => (
                <li key={l.quote.packageId} className="flex justify-between gap-3">
                  <span>{l.count} × {packageName(l.quote, lang)} ({rm(l.quote.finalPrice)})</span>
                  <span className="font-medium">{rm(l.subtotal)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-brand/15 pt-2 font-semibold">
              <span>{t("Total")}</span>
              <span className="text-lg" data-testid="live-total-amount">{rm(live.total)}</span>
            </p>
          </div>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="customerName" label={t("Your name")} required error={errors.customerName}>
          <input id="customerName" className="input" value={values.customerName} onChange={(e) => set("customerName")(e.target.value)} autoComplete="name" maxLength={100} aria-invalid={errors.customerName ? true : undefined} />
        </Field>
        <Field id="whatsapp" label={t("WhatsApp number (with country code)")} required error={errors.whatsapp} help={state.deliveryMethod === "whatsapp" ? t("Your report will be sent to this WhatsApp number.") : t("We will contact you here about your order.")}>
          <input id="whatsapp" className="input" type="tel" inputMode="tel" placeholder="+60 12-345 6789" value={values.whatsapp} onChange={(e) => set("whatsapp")(e.target.value)} autoComplete="tel" aria-invalid={errors.whatsapp ? true : undefined} />
        </Field>
        {email && (
          <div className="sm:col-span-2">
            <Field id="email" label={t("Email for report delivery")} required error={errors.email}>
              <input id="email" className="input" type="email" value={values.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" aria-invalid={errors.email ? true : undefined} />
            </Field>
          </div>
        )}
      </div>

      <Field id="note" label={t("Note (optional)")} error={errors.note}>
        <textarea id="note" className="input" rows={3} maxLength={1000} value={values.note} onChange={(e) => set("note")(e.target.value)} placeholder={t("e.g. please exclude the reference list")} />
      </Field>

      <div className="space-y-3">
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <input id="authorised" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]" checked={authorised} onChange={(e) => setAuthorised(e.target.checked)} aria-invalid={errors.authorised ? true : undefined} />
          <span>{t("I confirm I am the author of this document or am authorised to submit it for checking.")}</span>
        </label>
        {errors.authorised && <p role="alert" className="text-sm text-bad">{errors.authorised}</p>}
        <label className="flex items-start gap-3 text-sm text-ink-soft">
          <input id="terms" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]" checked={terms} onChange={(e) => setTerms(e.target.checked)} aria-invalid={errors.terms ? true : undefined} />
          <span>
            {t("I understand this is a manual service, results are indicators only, and I accept the")}{" "}
            <a href="/terms" target="_blank" className="font-medium text-brand underline">{t("terms and privacy notice")}</a>.
          </span>
        </label>
        {errors.terms && <p role="alert" className="text-sm text-bad">{errors.terms}</p>}
      </div>

      {formError && <p role="alert" className="text-sm text-bad">{formError}</p>}
      <button type="submit" className={`${buttonClass("primary")} w-full sm:w-auto`} disabled={busy} data-testid="review-order">
        {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {t("Review order")}
      </button>
    </form>
  );
}
