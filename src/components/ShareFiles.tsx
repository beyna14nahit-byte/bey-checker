"use client";

import { useEffect, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { translator, type Lang } from "@/lib/i18n";
import { buttonClass } from "./ui/button";

type Shared = { url: string; name: string; mime: string };

/**
 * Opens the phone's share sheet with the customer's document(s) and receipt attached, so they can
 * pick WhatsApp and our chat. Only shown on devices that can share files (most phones).
 */
export function ShareFiles({ files, text, lang, className }: { files: Shared[]; text: string; lang: Lang; className?: string }) {
  const t = translator(lang);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const probe = new File(["x"], "x.txt", { type: "text/plain" });
      setSupported(typeof navigator.share === "function" && !!navigator.canShare?.({ files: [probe] }));
    } catch {
      setSupported(false);
    }
  }, []);

  if (!supported || files.length === 0) return null;

  async function share() {
    setBusy(true);
    setError("");
    try {
      const list = await Promise.all(
        files.map(async (f) => {
          const res = await fetch(f.url, { cache: "no-store" });
          if (!res.ok) throw new Error(String(res.status));
          return new File([await res.blob()], f.name, { type: f.mime });
        }),
      );
      if (!navigator.canShare?.({ files: list })) throw new Error("unsupported");
      await navigator.share({ files: list, text });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(t("Your phone could not share the files. Please use the WhatsApp button above instead."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <button type="button" onClick={share} disabled={busy} className={`${buttonClass("secondary")} w-full sm:w-auto`} data-testid="share-files">
        {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Paperclip className="h-4 w-4" aria-hidden="true" />}
        {t("Attach the files in WhatsApp")}
      </button>
      <p className="text-xs text-muted">{t("Opens your phone's share menu with your document and receipt attached. Choose WhatsApp, then the Bey Checker chat.")}</p>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
