import { FileCheck2, FileText, QrCode, Upload, UserCheck } from "lucide-react";
import { getT } from "@/lib/i18n-server";
import { intlLocale, type T } from "@/lib/i18n";
import { getPublicState, toClientState } from "@/lib/public-state";
import { getPublishedTestimonials } from "@/lib/testimonials";
import { formatMy } from "@/lib/time";
import { rm } from "@/lib/pricing";
import { buttonClass } from "@/components/ui/button";
import { Card, Container, Notice } from "@/components/ui/card";
import { Reveal } from "@/components/Reveal";
import { OrderForm } from "@/components/OrderForm";
import { Pricing } from "@/components/ui/pricing";

function FlowGraphic({ t }: { t: T }) {
  const steps = [
    { icon: FileText, label: t("Your document") },
    { icon: UserCheck, label: t("Checked by a person") },
    { icon: FileCheck2, label: t("Your report") },
  ];
  return (
    <div className="relative rounded-2xl border border-line bg-white p-6 sm:p-8" aria-hidden="true">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_70%_20%,rgba(3,105,161,0.08),transparent_60%)]" />
      <div className="relative flex items-center justify-between gap-2">
        {steps.map(({ icon: Icon, label }, i) => (
          <div key={label} className="contents">
            <div className={`rise rise-${i + 1} flex w-20 shrink-0 flex-col items-center gap-2 text-center sm:w-24 lg:w-20 xl:w-24`}>
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${i === 1 ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
                <Icon className="h-7 w-7" />
              </span>
              <span className="text-xs font-medium text-ink-soft sm:text-sm">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <svg className="mb-6 h-2 w-0 min-w-0 flex-1" viewBox="0 0 100 4" preserveAspectRatio="none">
                <line x1="0" y1="2" x2="100" y2="2" stroke="currentColor" strokeWidth="2" className="flow-line text-brand/50" vectorEffect="non-scaling-stroke" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [{ lang, t }, state, testimonials] = await Promise.all([getT(), getPublicState(), getPublishedTestimonials()]);
  const q = state.quote;
  const promoLabel = q.promo ? (lang === "ms" ? q.promo.labelMs : q.promo.labelEn) || q.promo.labelEn : "";
  const turnaround = lang === "ms" ? state.turnaroundMs || state.turnaroundEn : state.turnaroundEn;
  const delivery = state.deliveryMethod === "email" ? t("by email") : t("on WhatsApp");

  const faqs: [string, string][] = [
    [t("Is the check automatic?"), t("No. After your payment is verified, a person runs your document through an AI detection tool and prepares the report. Uploading a document does not check it automatically.")],
    [t("What do I receive?"), t("A report showing the AI detection tool's result for your document, sent to you {delivery}.", { delivery })],
    [t("Does the report prove whether AI wrote my work?"), t("No. AI detection results are indicators only and cannot prove authorship. We do not guarantee any particular percentage or academic outcome.")],
    [t("How do I pay?"), t("After placing your order you will see a DuitNow QR and the exact amount. Pay, then upload your receipt. Your payment shows as \"Payment under review\" until we verify it manually.")],
    [t("How long does it take?"), turnaround ? turnaround : t("We will tell you the expected time when we confirm your payment.")],
    [t("What happens to my document?"), t("It is stored privately and only our administrator can open it. See the terms and privacy page for how long files are kept and how to ask for deletion.")],
  ];

  return (
    <>
      <section className="border-b border-line bg-white">
        <Container className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <p className="rise text-sm font-semibold uppercase tracking-wide text-brand">{t("Manual AI detection report")}</p>
            <h1 className="rise rise-1 mt-3 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">{t("Check your document for AI writing before you submit.")}</h1>
            <p className="rise rise-2 mt-4 max-w-xl text-lg text-ink-soft">
              {t("Upload your document, pay by DuitNow QR, and we run the AI check for you and send the report {delivery}.", { delivery })}
            </p>
            <div className="rise rise-3 mt-7 flex flex-col gap-3 sm:flex-row">
              <a href="#order" className={buttonClass("primary")} data-testid="hero-cta">
                {t("Check AI")}
              </a>
              <a href="#how" className={buttonClass("secondary")}>
                {t("How it works")}
              </a>
            </div>
          </div>
          <FlowGraphic t={t} />
        </Container>
      </section>

      <Container className="grid items-start gap-6 py-12 md:grid-cols-2">
        <Pricing
          testId="price-card"
          className="h-full"
          plans={[
            {
              id: "ai",
              name: t("AI detection report"),
              price: rm(q.finalPrice),
              normalPrice: q.promo ? rm(q.normalPrice) : null,
              unit: t("per document · MYR"),
              features: [
                t("One document per order. The price you see is the price you pay."),
                t("Checked manually by a person after your payment is verified"),
                t("Report sent {delivery}", { delivery }),
                t("Accepted: {types}, up to {mb} MB.", { types: state.formats.map((f) => f.toUpperCase()).join(", "), mb: state.maxMb }),
                ...(turnaround ? [t("Turnaround: {time}", { time: turnaround })] : []),
              ],
              buttonText: t("Check AI"),
              href: "#order",
              // The badge only names a promotion that is actually running.
              highlight: q.promo ? promoLabel : null,
            },
          ]}
          note={q.promo ? t("{promo} until {date}", { promo: promoLabel, date: formatMy(q.promo.endsAt, true, intlLocale(lang)) }) : undefined}
        />
        <Reveal>
          <Card className="h-full" >
            <p className="text-sm font-semibold text-brand">{t("Please note")}</p>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              <li>{t("This is a manual service: a person runs the check after your payment is verified.")}</li>
              <li>{t("AI detection results are indicators. They do not prove who wrote a document.")}</li>
              <li>{t("We do not guarantee any particular AI percentage or academic outcome.")}</li>
            </ul>
          </Card>
        </Reveal>
      </Container>

      <section id="how" aria-labelledby="how-title" className="border-y border-line bg-white">
        <Container className="py-12">
          <h2 id="how-title" className="text-2xl font-bold">{t("How it works")}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Upload, title: t("Upload and review"), text: t("Choose your document, enter your details and check the final amount before you confirm.") },
              { icon: QrCode, title: t("Pay by DuitNow QR"), text: t("Scan the QR on your order page and upload your receipt. We verify every payment manually.") },
              { icon: FileCheck2, title: t("Receive your report"), text: t("We run the check and send the report {delivery}.", { delivery }) },
            ].map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <Reveal className="h-full">
                  <div className="h-full rounded-2xl border border-line p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="text-sm font-semibold text-muted">{t("Step {n}", { n: i + 1 })}</span>
                    </div>
                    <p className="mt-3 font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="order" aria-labelledby="order-title" className="scroll-mt-20">
        <Container className="max-w-3xl py-12">
          <h2 id="order-title" className="text-2xl font-bold">{t("Order your AI check")}</h2>
          {state.checkoutOpen ? (
            <div className="mt-6">
              <OrderForm initial={toClientState(state)} lang={lang} />
            </div>
          ) : (
            <Notice tone="warn" className="mt-6" data-testid="checkout-closed">
              {t("Ordering is temporarily unavailable while we set up payments. Please check back soon.")}
            </Notice>
          )}
        </Container>
      </section>

      {testimonials.length > 0 && (
        <section aria-labelledby="feedback-title" className="border-t border-line bg-white">
          <Container className="py-12">
            <h2 id="feedback-title" className="text-2xl font-bold">{t("What customers said")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {testimonials.map((r) => (
                <Reveal key={r.id}>
                  <figure className="h-full rounded-2xl border border-line p-5">
                    {r.rating && <p className="text-sm font-semibold text-brand" aria-label={t("Rating: {n} out of 5", { n: r.rating })}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</p>}
                    <blockquote className="mt-2 text-ink-soft">“{r.feedback}”</blockquote>
                    <figcaption className="mt-3 text-sm font-medium">{r.display_name}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="faq-title" className="border-t border-line">
        <Container className="max-w-3xl py-12">
          <h2 id="faq-title" className="text-2xl font-bold">{t("Questions")}</h2>
          <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
            {faqs.map(([q2, a]) => (
              <details key={q2} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:hidden">
                  {q2}
                  <span aria-hidden="true" className="text-brand transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
