"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { translator, type Lang } from "@/lib/i18n";
import { buttonClass } from "./ui/button";
import { Field, ProgressBar } from "./fields";
import { postForm } from "./upload";

export function ReceiptUpload({ reference, accessKey, lang, again }: { reference: string; accessKey: string; lang: Lang; again?: boolean }) {
  const t = translator(lang);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  return (
    <form
      noValidate
      className="space-y-4"
      data-testid="receipt-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!file) {
          setError(t("Please choose your payment receipt."));
          return;
        }
        setProgress(0);
        const res = await postForm(`/api/orders/${encodeURIComponent(reference)}/receipt`, { k: accessKey, paymentReference }, file, setProgress, t);
        setProgress(null);
        if (res.ok) {
          router.refresh();
          // Bring the "send on WhatsApp" step into view once the refreshed page shows it.
          let tries = 0;
          const id = setInterval(() => {
            const el = document.getElementById("send-title");
            if (el || ++tries > 30) {
              clearInterval(id);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 100);
        }
        else setError(res.message);
      }}
    >
      <Field id="receipt" label={again ? t("Upload another receipt") : t("Payment receipt")} required help={t("Screenshot or PDF of your successful payment (PNG, JPG, WEBP or PDF, up to 4 MB).")}>
        <input id="receipt" type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-brand-soft file:px-4 file:text-sm file:font-semibold file:text-brand-dark" data-testid="receipt-input" />
      </Field>
      <Field id="paymentReference" label={t("Transaction reference (optional)")}>
        <input id="paymentReference" className="input" maxLength={100} value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder={t("e.g. DuitNow reference number")} />
      </Field>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {progress !== null && <ProgressBar value={progress} label={t("Upload progress")} />}
      <button type="submit" disabled={progress !== null} className={`${buttonClass("primary")} w-full sm:w-auto`} data-testid="send-receipt">
        {progress !== null && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
        {t("Send payment proof")}
      </button>
    </form>
  );
}
