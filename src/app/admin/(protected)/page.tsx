import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getQrInfo, getSettings } from "@/lib/settings";
import { getQuotes, promotionWindowValid, rm } from "@/lib/pricing";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/config";
import { formatMy } from "@/lib/time";
import { Flash, StatusPill, adminBtn, adminInput } from "@/components/admin";

type Row = { id: string; reference: string; created_at: Date; customer_name: string; whatsapp: string; amount_due: string; status: OrderStatus; filename: string | null; package_name_en: string; item_count: number };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ok?: string; bad?: string }> }) {
  const sp = await searchParams;
  const sql = db();
  const [s, qr] = await Promise.all([getSettings(), getQrInfo()]);
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const siteHost = process.env.SITE_URL ? (() => { try { return new URL(process.env.SITE_URL!).host; } catch { return "invalid"; } })() : null;
  const quotes = getQuotes(s);
  const promo = quotes.find((q) => q.promo)?.promo ?? null;

  const checklist: [boolean, string][] = [
    [qr.configured, "Payment QR uploaded (checkout stays closed without it)"],
    [!!s.contact.whatsapp, "Contact WhatsApp number set (checkout stays closed without it)"],
    [s.launch.uploadRulesConfirmed, "Accepted formats and file size confirmed"],
    [!!s.delivery.turnaroundEn && !!s.delivery.turnaroundMs, "Turnaround wording set (EN and BM)"],
    [!s.promotion.enabled || promotionWindowValid(s.promotion), s.promotion.enabled ? "Promotion dates valid" : "Promotion is off (set confirmed dates to enable it)"],
    [s.retention.confirmed, "File retention policy confirmed"],
    [siteHost === host, `SITE_URL matches this domain (${siteHost ?? "not set"})`],
  ];

  const q = (sp.q ?? "").trim();
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? sp.status! : "";
  const rows = await sql<Row[]>`
    select o.id, o.reference, o.created_at, o.customer_name, o.whatsapp, o.amount_due, o.status, o.package_name_en, o.item_count,
      (select filename from files f where f.order_id = o.id and f.kind = 'document' order by created_at limit 1) as filename
    from orders o where true
      ${q ? sql`and (o.reference ilike ${like} or o.customer_name ilike ${like} or o.whatsapp ilike ${like})` : sql``}
      ${status ? sql`and o.status = ${status}` : sql``}
    order by case o.status when 'payment_review' then 0 when 'payment_verified' then 1 when 'processing' then 2 else 3 end, o.created_at desc
    limit 200`;
  const counts = await sql<{ status: OrderStatus; n: number }[]>`select status, count(*)::int as n from orders group by status`;
  const count = (st: OrderStatus) => counts.find((c) => c.status === st)?.n ?? 0;

  return (
    <>
      <Flash ok={sp.ok} bad={sp.bad} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {(["payment_review", "awaiting_payment", "payment_verified", "processing"] as OrderStatus[]).map((st) => (
              <Link key={st} href={`/admin?status=${st}`} className="rounded-xl border border-line bg-white px-3 py-2 hover:border-brand">
                {STATUS_LABELS[st]}: <strong>{count(st)}</strong>
              </Link>
            ))}
          </div>
          <form className="mt-4 flex flex-wrap gap-2" method="get">
            <input name="q" defaultValue={q} placeholder="Reference, name or phone" className={`${adminInput} max-w-xs`} aria-label="Search orders" />
            <select name="status" defaultValue={status} className={`${adminInput} max-w-[220px]`} aria-label="Status">
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABELS[st]}</option>)}
            </select>
            <button className={adminBtn}>Search</button>
          </form>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-secondary text-muted">
                <tr><th className="px-3 py-2.5 font-medium">Order</th><th className="px-3 py-2.5 font-medium">Customer</th><th className="px-3 py-2.5 font-medium">Amount</th><th className="px-3 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted">No orders.</td></tr>}
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-paper" data-testid="admin-order-row">
                    <td className="px-3 py-2.5"><Link href={`/admin/orders/${o.id}`} className="font-mono font-semibold text-brand hover:underline">{o.reference}</Link><div className="text-xs text-muted">{formatMy(o.created_at)} · {o.filename ? `${o.filename}${o.item_count > 1 ? ` +${o.item_count - 1} more` : ""}` : "files removed"}</div></td>
                    <td className="px-3 py-2.5">{o.customer_name}<div className="text-xs text-muted">+{o.whatsapp}</div></td>
                    <td className="px-3 py-2.5"><span className="font-semibold">{rm(o.amount_due)}</span><div className="text-xs text-muted">{o.package_name_en}</div></td>
                    <td className="px-3 py-2.5"><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Launch checklist</h2>
            <ul className="mt-3 space-y-2 text-sm" data-testid="launch-checklist">
              {checklist.map(([done, label]) => (
                <li key={label} className="flex gap-2">
                  {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Done" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-label="To do" />}
                  <span className={done ? "text-ink-soft" : ""}>{label}</span>
                </li>
              ))}
            </ul>
            <Link href="/admin/settings" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Open settings</Link>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 text-sm">
            <h2 className="font-semibold">Prices right now</h2>
            <ul className="mt-2 space-y-1">
              {quotes.map((q) => (
                <li key={q.packageId} className="flex justify-between gap-3"><span>{q.nameEn}</span><strong>{rm(q.finalPrice)}</strong></li>
              ))}
            </ul>
            <p className="mt-2 text-muted">{promo ? `Promotion until ${formatMy(promo.endsAt)}` : quotes.some((q) => q.changesAt) ? "Promotion scheduled" : "Normal prices"}</p>
          </div>
        </aside>
      </div>
    </>
  );
}
