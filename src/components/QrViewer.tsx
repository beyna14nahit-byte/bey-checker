"use client";

import { useRef } from "react";
import { translator, type Lang } from "@/lib/i18n";

/** The owner's QR exactly as uploaded, with a full-screen view for easier scanning. */
export function QrViewer({ src, lang }: { src: string; lang: Lang }) {
  const t = translator(lang);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div>
      <button type="button" onClick={() => dialog.current?.showModal()} className="block w-full rounded-2xl border border-line bg-white p-1.5 transition-colors duration-200 hover:border-brand" aria-label={t("Enlarge payment QR code")} data-testid="qr-open">
        {/* eslint-disable-next-line @next/next/no-img-element -- served byte-for-byte */}
        <img src={src} alt={t("Payment QR code")} className="mx-auto h-auto w-full max-w-[340px]" data-testid="payment-qr" />
        <span className="mt-2 block text-center text-sm font-semibold text-brand">{t("Tap to enlarge")}</span>
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {t("Paying from this phone?")}{" "}
        <a href={src} download="payment-qr" className="font-semibold text-brand underline">{t("Save the QR image")}</a>{" "}
        {t("and scan it from your gallery in your banking app.")}
      </p>
      <dialog ref={dialog} className="m-auto max-h-[100dvh] max-w-[100vw] bg-transparent p-0 backdrop:bg-ink/80" onClick={(e) => e.target === dialog.current && dialog.current?.close()} aria-label={t("Payment QR code, enlarged")}>
        <div className="flex max-h-[100dvh] flex-col items-center gap-3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={t("Payment QR code")} className="h-auto max-h-[calc(100dvh-5rem)] w-auto max-w-[calc(100vw-1.5rem)] rounded-xl bg-white" />
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-xl bg-white px-5 text-sm font-semibold">{t("Close")}</button>
        </div>
      </dialog>
    </div>
  );
}
