import type { Metadata } from "next";
import { CheckCircle2, Circle, FileText, MessageCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { intlLocale } from "@/lib/i18n";
import { canUploadReceipt, getOrderForCustomer, getOrderItems, paymentDeadlinePassed } from "@/lib/orders";
import { ownerMessage } from "@/lib/order-message";
import { siteBase } from "@/lib/site-url";
import { getQrInfo, getSettings } from "@/lib/settings";
import { STATUS_LABELS, type OrderStatus } from "@/lib/config";
import { rm } from "@/lib/pricing";
import { formatMy } from "@/lib/time";
import { waLink } from "@/lib/contact";
import { buttonClass } from "@/components/ui/button";
import { Card, Container, Notice } from "@/components/ui/card";
import { QrViewer } from "@/components/QrViewer";
import { ReceiptUpload } from "@/components/ReceiptUpload";
import { ShareFiles } from "@/components/ShareFiles";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };

const TRACK: OrderStatus[] = ["awaiting_payment", "payment_review", "payment_verified", "processing", "completed"];

export default async function OrderPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ k?: string }> }) {
  const { ref } = await params;
  const { k = "" } = await searchParams;
  const [{ lang, t }, order, settings] = await Promise.all([getT(), getOrderForCustomer(decodeURIComponent(ref), k), getSettings()]);
  const fmt = (d: Date | string | null) => formatMy(d, true, intlLocale(lang));
  const contact = settings.contact.whatsapp;

  if (!order) {
    return (
      <Container className="max-w-2xl py-16">
        <h1 className="text-2xl font-bold">{t("Order not found")}</h1>
        <p className="mt-3 text-ink-soft">{t("Please open the private link from your order confirmation. If you lost it, contact us with your order reference.")}</p>
        {contact && <a href={waLink(contact)} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary")} mt-6`}>WhatsApp</a>}
      </Container>
    );
  }

  const [items, receipts, qr, base] = await Promise.all([
    getOrderItems(order.id),
    db()<{ id: string; filename: string; mime: string }[]>`select id, filename, mime from files where order_id = ${order.id} and kind = 'receipt' order by created_at desc limit 1`,
    getQrInfo(),
    siteBase(),
  ]);
  const receipt = receipts[0] ?? null;
  const deadlinePassed = paymentDeadlinePassed(order);
  const uploadOpen = canUploadReceipt(order);
  const amount = Number(order.amount_due);
  const delivery = order.delivery_method === "email" ? t("by email to {email}", { email: order.email ?? "" }) : t("on WhatsApp to +{number}", { number: order.whatsapp });
  const instructions = lang === "ms" ? settings.payment.instructionsMs : settings.payment.instructionsEn;
  const nameOf = (i: { package_name_en: string; package_name_ms: string }) => (lang === "ms" ? i.package_name_ms || i.package_name_en : i.package_name_en);
  const message = ownerMessage(order, items, receipt, base);
  const paidAndSent = order.status === "payment_review";
  const fileUrl = (id: string) => `/api/orders/${encodeURIComponent(order.reference)}/files/${id}?k=${encodeURIComponent(k)}`;
  const shareable = [
    ...items.flatMap((i) => (i.file_id ? [{ url: fileUrl(i.file_id), name: i.filename, mime: "application/octet-stream" }] : [])),
    ...(receipt ? [{ url: fileUrl(receipt.id), name: receipt.filename, mime: receipt.mime }] : []),
  ];
  const stepIndex = TRACK.indexOf(order.status);

  return (
    <Container className="max-w-3xl space-y-6 py-10">
      <div className="rise">
        <p className="text-sm text-muted">{t("Order reference")}</p>
        <h1 className="font-mono text-2xl font-bold sm:text-3xl" data-testid="order-ref">{order.reference}</h1>
        <p className="mt-1 text-sm text-muted">{t("Keep this page's link private. Anyone with it can see your order status.")}</p>
      </div>

      {order.status === "cancelled" ? (
        <Notice tone="bad" data-testid="status-cancelled">{t("This order has been cancelled. Contact us if you have questions.")}</Notice>
      ) : (
        <ol className="rise rise-1 grid grid-cols-5 gap-1" aria-label={t("Order progress")}>
          {TRACK.map((s, i) => {
            const done = i < stepIndex || (i === stepIndex && s === "completed");
            const current = i === stepIndex;
            return (
              <li key={s} className="flex flex-col items-center gap-1.5 text-center" aria-current={current ? "step" : undefined}>
                <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-brand" : "bg-line"}`} />
                {done ? <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden="true" /> : <Circle className={`h-4 w-4 ${current ? "soft-pulse text-brand" : "text-line"}`} aria-hidden="true" />}
                <span className={`text-[11px] leading-tight sm:text-xs ${current ? "font-semibold text-ink" : "text-muted"}`}>{t(STATUS_LABELS[s])}</span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-sm">
        {t("Current status:")} <strong data-testid="order-status">{t(STATUS_LABELS[order.status])}</strong>
      </p>

      {contact && paidAndSent && (
        <section aria-labelledby="send-title" className="pop rounded-2xl border-2 border-brand/30 bg-white p-5 sm:p-7" data-testid="send-section">
          <h2 id="send-title" className="text-xl font-bold">{t("Last step: send your order to us on WhatsApp")}</h2>
          <p className="mt-2 text-sm text-ink-soft">{t("Tap the button to open WhatsApp with your order, payment and file details already written. Just press send.")}</p>
          <a href={waLink(contact, message)} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary")} mt-4 w-full sm:w-auto`} data-testid="order-whatsapp">
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t("Send order on WhatsApp")}
          </a>
          <p className="mt-3 text-xs text-muted">{t("Your files are already safely with us, so you do not need to attach them.")}</p>
          <ShareFiles files={shareable} text={message} lang={lang} className="mt-5 border-t border-line pt-5" />
        </section>
      )}

      <Card>
        <h2 className="font-semibold">{t("Order details")}</h2>
        <dl className="mt-3 divide-y divide-line text-sm">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between gap-4 py-2.5" data-testid="order-item">
              <dt className="min-w-0">
                <span className="font-medium">{nameOf(i)}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-muted">
                  <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-all">{i.file_id ? i.filename : t("Removed under our retention policy")}</span>
                </span>
              </dt>
              <dd className="shrink-0 text-right">{rm(i.price)}</dd>
            </div>
          ))}
          {[
            ...(Number(order.discount) > 0 ? [[t("Normal price"), rm(order.normal_price)]] : []),
            ...(Number(order.discount) > 0 ? [[order.promo_label ? t("{promo} discount", { promo: order.promo_label }) : t("Discount"), `-${rm(order.discount)}`]] : []),
            [t("Report delivery"), delivery],
            [t("Placed"), fmt(order.created_at)],
            ...(order.payment_due_at ? [[t("Pay by"), fmt(order.payment_due_at)]] : []),
          ].map(([k2, v]) => (
            <div key={k2} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{k2}</dt>
              <dd className="min-w-0 break-words text-right">{v}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <dt className="font-semibold">{t("Amount due")}</dt>
            <dd className="text-2xl font-extrabold" data-testid="amount-due">{rm(amount)}</dd>
          </div>
        </dl>
      </Card>

      {order.status === "awaiting_payment" && deadlinePassed && (
        <Notice tone="warn" data-testid="deadline-passed">{t("The payment deadline for this order has passed. Please contact us before paying.")}</Notice>
      )}

      {order.status === "awaiting_payment" && order.payment_rejection_reason && (
        <Notice tone="bad">{t("We could not verify your previous receipt: {reason}. Please check and send it again, or contact us.", { reason: order.payment_rejection_reason })}</Notice>
      )}

      {order.status === "payment_review" && (
        <Notice tone="warn" data-testid="pending-verification">
          <strong>{t("Pending verification.")}</strong> {t("We received your receipt on {date}. Your payment is not confirmed until we check it manually.", { date: fmt(order.receipt_uploaded_at) })}
        </Notice>
      )}

      {(order.status === "payment_verified" || order.status === "processing") && (
        <Notice tone="ok" data-testid="payment-verified">{t("Payment verified. We will run your checks and send the report {delivery}.", { delivery })}</Notice>
      )}

      {order.status === "completed" && (
        <Notice tone="ok">{t("Your report has been sent {delivery}. If you have not received it, please contact us.", { delivery })}</Notice>
      )}

      {order.status === "awaiting_payment" && uploadOpen && (
        <section aria-labelledby="pay-title" className="rise rise-2 rounded-2xl border border-line bg-white p-4 sm:p-7" data-testid="payment-section">
          <h2 id="pay-title" className="text-xl font-bold">{t("Pay {amount}", { amount: rm(amount) })}</h2>
          {qr.configured ? (
            <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
              <QrViewer src={`/api/payment-qr?v=${qr.version}`} lang={lang} />
              <div className="space-y-4 text-sm">
                <dl className="grid gap-2 rounded-xl bg-paper p-4">
                  <div className="flex justify-between gap-3"><dt className="text-muted">{t("Order reference")}</dt><dd className="font-mono font-semibold">{order.reference}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted">{t("Pay with")}</dt><dd>{settings.payment.provider}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-line pt-2"><dt className="text-muted">{t("Exact amount")}</dt><dd className="text-lg font-bold">{rm(amount)}</dd></div>
                </dl>
                <p className="whitespace-pre-line leading-relaxed text-ink-soft">{instructions}</p>
                <p className="font-medium">{t("We will never ask for your banking password, PIN or TAC.")}</p>
              </div>
            </div>
          ) : (
            <Notice tone="warn" className="mt-4">{t("Payment details are not available right now. Please contact us before paying.")}</Notice>
          )}
          <div className="mt-6 border-t border-line pt-6">
            <ReceiptUpload reference={order.reference} accessKey={k} lang={lang} />
          </div>
        </section>
      )}

      {order.status === "payment_review" && uploadOpen && (
        <details className="rounded-2xl border border-line bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold">{t("Sent the wrong receipt? Upload another one")}</summary>
          <div className="mt-4">
            <ReceiptUpload reference={order.reference} accessKey={k} lang={lang} again />
          </div>
        </details>
      )}

      {contact && order.status === "awaiting_payment" && uploadOpen && (
        <p className="text-sm text-ink-soft" data-testid="send-after-receipt">{t("After you upload your receipt, a button will appear to send your order to us on WhatsApp in one tap.")}</p>
      )}

      {contact && !paidAndSent && (
        <a href={waLink(contact, lang === "ms" ? `Hai Bey Checker, tentang pesanan ${order.reference}: ` : `Hi Bey Checker, about order ${order.reference}: `)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")} data-testid="order-whatsapp">
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {order.status === "awaiting_payment" ? t("Questions? WhatsApp us") : t("Contact us on WhatsApp")}
        </a>
      )}
    </Container>
  );
}
