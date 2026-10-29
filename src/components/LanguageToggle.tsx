"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";

export function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  function choose(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next === "ms" ? "ms-MY" : "en-MY";
    router.refresh();
  }
  return (
    <div role="group" aria-label="Language / Bahasa" className="inline-flex overflow-hidden rounded-lg border border-line text-xs font-semibold" data-testid="lang-toggle">
      {(["en", "ms"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          lang={l === "ms" ? "ms" : "en"}
          className={`min-h-11 min-w-11 px-3 ${lang === l ? "bg-ink text-white" : "bg-white text-ink-soft hover:text-ink"}`}
          data-testid={`lang-${l}`}
        >
          {l === "en" ? "EN" : "BM"}
        </button>
      ))}
    </div>
  );
}
