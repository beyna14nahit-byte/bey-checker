import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { getPublicState } from "@/lib/public-state";
import { formatMy } from "@/lib/time";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PriceWatcher } from "@/components/PriceWatcher";
import KineticGrid from "@/components/ui/kinetic-grid";
import { Container } from "@/components/ui/card";
import { waLink } from "@/lib/contact";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ lang, t }, state] = await Promise.all([getT(), getPublicState()]);
  const promo = state.quotes.find((q) => q.promo)?.promo ?? null;
  const label = promo ? (lang === "ms" ? promo.labelMs : promo.labelEn) || promo.labelEn : "";
  return (
    <KineticGrid>
      <PriceWatcher changesAt={state.changesAt} serverTime={state.serverTime} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        {t("Skip to content")}
      </a>
      {promo && (
        <div className="bg-ink px-4 py-2 text-center text-xs text-white sm:text-sm" data-testid="promo-banner">
          <span className="font-semibold">{label}</span>{" "}
          {t("until {date}.", { date: formatMy(promo.endsAt, true, intlLocale(lang)) })}{" "}
          <a href="/#pricing" className="underline underline-offset-2">{t("See prices")}</a>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span aria-hidden="true" className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-ink px-1.5 text-xs font-bold tracking-wide text-white">BEY</span>
            Bey Checker
          </Link>
          <LanguageToggle lang={lang} />
        </Container>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-16 border-t border-line bg-white/95">
        <Container className="flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Bey Checker · {t("Manual AI detection report service, Malaysia.")}</p>
          <nav aria-label={t("Footer")} className="flex flex-wrap gap-x-5 gap-y-2">
            {state.whatsapp && (
              <a href={waLink(state.whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
                WhatsApp +{state.whatsapp}
              </a>
            )}
            {state.email && <a href={`mailto:${state.email}`} className="hover:text-brand">{state.email}</a>}
            {state.telegramUrl && <a href={state.telegramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Telegram</a>}
            <Link href="/terms" className="hover:text-brand">{t("Terms & privacy")}</Link>
          </nav>
        </Container>
      </footer>
    </KineticGrid>
  );
}
