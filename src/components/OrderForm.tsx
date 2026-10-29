"use client";

import { useRef, useState } from "react";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { intlLocale, translator, type Lang } from "@/lib/i18n";
import type { PublicState } from "@/lib/public-state";
import type { Quote } from "@/lib/pricing";
import { rm } from "@/lib/pricing";
import { formatMy } from "@/lib/time";
import { buttonClass } from "./ui/button";
import { Notice } from "./ui/card";
import { Field, ProgressBar } from "./fields";
import { postForm } from "./upload";

type Values = { customerName: string; whatsapp: string; email: string; note: string };

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function OrderForm({ initial, lang }: { initial: PublicState; lang: Lang }) {
  const t = translator(lang);
  const [state, setState] = useState(initial);
  const [values, setValues] = useState<Values>({ customerName: "", whatsapp: "", email: "", note: "" });
  const [file, setFile] = useState<File | null>(null);
  const [authorised, setAuthorised] = useState(false);
  const [terms, setTerms] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [priceChange, setPriceChange] = useState<{ from: number; to: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  // One key per checkout: a double click or retry returns the same order instead of a duplicate.
  const key = useRef(newKey());
  const fileInput = useRef<HTMLInputElement>(null);

  const set = (k: keyof Values) => (v: string) => setValues((cur) => ({ ...cur, [k]: v }));
  const email = state.deliveryMethod === "email";
  const accept = state.formats.map((f) => `.${f}`).join(",");
  const typesText = state.formats.map((f) => f.toUpperCase()).join(", ");
  const turnaround = lang === "ms" ? state.turnaroundMs || state.turnaroundEn : state.turnaroundEn;

  function checkLocally(): Record<string, string> {
    const e: Record<string, string> = {};
    if (values.customerName.trim().length < 2) e.customerName = t("Please enter your name.");
    if (values.whatsapp.replace(/\D/g, "").length < 9) e.whatsapp = t("Please enter a valid WhatsApp number with country code, e.g. +60 12-345 6789.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(values.email.trim())) e.email = t("Please enter a valid email address for report delivery.");
    if (!file) e.file = t("Please choose your document.");
    else {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!state.formats.includes(ext)) e.file = t("This file type is not accepted. Accepted formats: {types}.", { types: typesText });
      else if (file.size > state.maxMb * 1024 * 1024) e.file = t("The file is larger than {mb} MB.", { mb: state.maxMb });
      else if (file.size === 0) e.file = t("The file is empty.");
    }
    if (!authorised) e.authorised = t("Please confirm that you are allowed to submit this document.");
    if (!terms) e.terms = t("Please accept the service and privacy terms.");
    return e;
  }

  async function review() {
    setFormError("");
    const e = checkLocally();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(Object.keys(e)[0])?.focus();
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
      setQuote(body.quote);
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
    if (!quote || !file || busy) return;
    setBusy(true);
    setFormError("");
    setProgress(0);
    const res = await postForm<{ orderUrl: string }>(
      "/api/orders",
      { ...values, authorised, terms, idempotencyKey: key.current, expectedAmount: quote.finalPrice },
      file,
      setProgress,
      t,
    );
    setProgress(null);
    if (res.ok) {
      window.location.assign(res.orderUrl);
      return; // keep the button disabled while the order page loads
    }
    setBusy(false);
    if (res.code === "price_changed" && res.quote) {
      setPriceChange({ from: quote.finalPrice, to: res.quote.finalPrice });
      setQuote(res.quote);
      return;
    }
    if (res.errors && Object.keys(res.errors).some((k) => k !== "form")) {
      setErrors(res.errors);
      setStep("form");
    }
    setFormError(res.message);
  }

  const labelOf = (q: Quote) => (q.promo ? (lang === "ms" ? q.promo.labelMs : q.promo.labelEn) || q.promo.labelEn : "");

  if (step === "review" && quote && file) {
    const rows: [string, string, string?][] = [
      [t("Service"), t("AI detection report (manual check)")],
      [t("Document"), file.name],
      [t("Pricing unit"), t("Per document")],
      [t("Normal price"), rm(quote.normalPrice), "summary-normal"],
    ];
    if (quote.discount > 0) rows.push([t("{promo} discount", { promo: labelOf(quote) }), `-${rm(quote.discount)}`, "summary-discount"]);
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
        <dl className="mt-5 divide-y divide-line text-sm">
          {rows.map(([k, v, id]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k}</dt>
              <dd className="min-w-0 break-words text-right font-medium" data-testid={id}>{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-4">
            <dt className="font-semibold">{t("Total to pay")}</dt>
            <dd className="text-3xl font-extrabold tracking-tight" data-testid="summary-total">{rm(quote.finalPrice)}</dd>
          </div>
        </dl>
        {quote.promo && (
          <p className="mt-2 text-right text-xs text-muted">{t("Promotion price valid until {date}.", { date: formatMy(quote.promo.endsAt, true, intlLocale(lang)) })}</p>
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
            {busy ? t("Placing order...") : t("Confirm order · {amount}", { amount: rm(quote.finalPrice) })}
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

      <Field id="file" label={t("Your document")} required error={errors.file} help={t("One document per order. Accepted: {types}, up to {mb} MB.", { types: typesText, mb: state.maxMb })}>
        <div className={`rounded-xl border border-dashed bg-paper p-4 ${errors.file ? "border-bad" : "border-line"}`}>
          <input
            ref={fileInput}
            id="file"
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-semibold file:text-brand-dark"
            aria-invalid={errors.file ? true : undefined}
            data-testid="document-input"
          />
          {file && (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-brand" aria-hidden="true" />
              <span className="min-w-0 truncate">{file.name}</span>
              <span className="shrink-0 text-muted">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </p>
          )}
        </div>
      </Field>

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
