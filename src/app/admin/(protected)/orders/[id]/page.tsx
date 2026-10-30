import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrderItems, orderPath, type OrderRow } from "@/lib/orders";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/config";
import { rm } from "@/lib/pricing";
import { formatMy } from "@/lib/time";
import { isImage } from "@/lib/files";
import { waLink } from "@/lib/contact";
import { Flash, Section, StatusPill, adminBtn, adminBtnDanger, adminBtnSecondary, adminInput } from "@/components/admin";
import { deleteOrderFiles, rejectPayment, saveNotes, updateStatus, verifyPayment } from "../../../actions";

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; bad?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sql = db();
  const [o] = await sql<OrderRow[]>`select * from orders where id = ${id}`;
  if (!o) notFound();
  const files = await sql<{ id: string; kind: string; filename: string; mime: string; size: number; created_at: Date }[]>`
    select id, kind, filename, mime, size, created_at from files where order_id = ${id} order by created_at`;
  const items = await getOrderItems(id);
  const itemByFile = new Map(items.filter((i) => i.file_id).map((i) => [i.file_id!, i]));
  const events = await sql<{ id: number; created_at: Date; actor: string; message: string }[]>`
    select id, created_at, actor, message from events where order_id = ${id} order by created_at desc, id desc`;
  const h = await headers();
  const base = process.env.SITE_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${base}${orderPath(o.reference, o.access_token)}`;
  const msg = o.lang === "ms"
    ? `Hai ${o.customer_name}, ini Bey Checker tentang pesanan ${o.reference}. Status pesanan anda: ${link}`
    : `Hi ${o.customer_name}, this is Bey Checker about order ${o.reference}. Your order status: ${link}`;

  return (
    <>
      <Link href="/admin" className="text-sm text-brand hover:underline">&larr; All orders</Link>
      <div className="mt-2 mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold" data-testid="admin-order-ref">{o.reference}</h1>
        <StatusPill status={o.status} />
      </div>
      <Flash ok={sp.ok} bad={sp.bad} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section title="Customer">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-muted">Checks</dt><dd className="font-semibold" data-testid="admin-package">{o.package_name_en}</dd></div>
              <div><dt className="text-muted">Name</dt><dd>{o.customer_name}</dd></div>
              <div><dt className="text-muted">WhatsApp</dt><dd>+{o.whatsapp}</dd></div>
              <div><dt className="text-muted">Report delivery</dt><dd>{o.delivery_method === "email" ? `Email: ${o.email}` : "WhatsApp"}</dd></div>
              <div><dt className="text-muted">Language</dt><dd>{o.lang === "ms" ? "Bahasa Melayu" : "English"}</dd></div>
              <div><dt className="text-muted">Placed</dt><dd>{formatMy(o.created_at)}</dd></div>
              {o.payment_due_at && <div><dt className="text-muted">Payment deadline</dt><dd>{formatMy(o.payment_due_at)}</dd></div>}
              {o.note && <div className="sm:col-span-2"><dt className="text-muted">Customer note</dt><dd className="whitespace-pre-wrap">{o.note}</dd></div>}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <a className={adminBtn} href={waLink(o.whatsapp, msg)} target="_blank" rel="noopener noreferrer">WhatsApp customer</a>
              <a className={adminBtnSecondary} href={link} target="_blank" rel="noopener noreferrer">Open customer page</a>
            </div>
          </Section>

          <Section title={`Files (${files.length})`}>
            {files.length === 0 ? <p className="text-sm text-muted">No files stored.</p> : (
              <ul className="divide-y divide-line text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0 break-all">
                      <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs uppercase">{f.kind === "document" && itemByFile.has(f.id) ? `Doc ${itemByFile.get(f.id)!.position}` : f.kind}</span>
                      {itemByFile.has(f.id) && <strong className="mr-1.5" data-testid="admin-item-package">{itemByFile.get(f.id)!.package_name_en}:</strong>}
                      {f.filename} <span className="text-muted">({Math.round(f.size / 1024)} KB · {formatMy(f.created_at)})</span></span>
                    <span className="flex gap-3">
                      {isImage(f.mime) && <a className="text-brand hover:underline" href={`/api/admin/files/${f.id}?inline=1`} target="_blank" rel="noopener">View</a>}
                      <a className="text-brand hover:underline" href={`/api/admin/files/${f.id}`} data-testid="admin-download">Download</a>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Private notes">
            <form action={saveNotes} className="space-y-2">
              <input type="hidden" name="id" value={o.id} />
              <textarea name="notes" defaultValue={o.owner_notes} rows={4} className={adminInput} aria-label="Private notes" />
              <button className={adminBtnSecondary}>Save notes</button>
            </form>
          </Section>

          <Section title="Timeline">
            <ol className="space-y-2 text-sm">
              {events.map((e) => <li key={e.id} className="flex flex-wrap gap-x-3"><span className="text-muted">{formatMy(e.created_at)}</span><span className="text-muted">{e.actor}</span><span>{e.message}</span></li>)}
            </ol>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Payment">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Normal price</dt><dd>{rm(o.normal_price)}</dd></div>
              {Number(o.discount) > 0 && <div className="flex justify-between"><dt className="text-muted">Discount{o.promo_label ? ` (${o.promo_label})` : ""}</dt><dd>-{rm(o.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><dt>Amount due ({o.currency})</dt><dd data-testid="admin-amount">{rm(o.amount_due)}</dd></div>
              {o.receipt_uploaded_at && <div className="flex justify-between"><dt className="text-muted">Receipt uploaded</dt><dd>{formatMy(o.receipt_uploaded_at)}</dd></div>}
              {o.payment_reference && <div className="flex justify-between gap-2"><dt className="text-muted">Customer reference</dt><dd className="break-all">{o.payment_reference}</dd></div>}
              {o.payment_verified_at && <div className="flex justify-between gap-2"><dt className="text-muted">Verified</dt><dd>{formatMy(o.payment_verified_at)} by {o.payment_verified_by}</dd></div>}
              {o.payment_rejection_reason && <div className="flex justify-between gap-2"><dt className="text-muted">Last rejection</dt><dd>{o.payment_rejection_reason}</dd></div>}
            </dl>
            {(o.status === "awaiting_payment" || o.status === "payment_review") && (
              <form action={verifyPayment} className="mt-4">
                <input type="hidden" name="id" value={o.id} />
                <button className={`${adminBtn} w-full`} data-testid="verify-payment">Verify payment ({rm(o.amount_due)} received)</button>
              </form>
            )}
            {(o.status === "payment_review" || o.status === "payment_verified") && (
              <form action={rejectPayment} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="reason" placeholder="Reason shown to the customer" className={adminInput} aria-label="Rejection reason" />
                <button className={`${adminBtnDanger} w-full`}>Reject receipt</button>
              </form>
            )}
            <p className="mt-3 text-xs text-muted">Check your bank or e-wallet before verifying. A customer upload never verifies payment.</p>
          </Section>

          <Section title="Status">
            <form action={updateStatus} className="flex gap-2">
              <input type="hidden" name="id" value={o.id} />
              <select name="status" defaultValue={o.status} className={adminInput} aria-label="Order status">
                {ORDER_STATUSES.filter((s) => s !== "payment_verified" || o.status === "payment_verified").map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <button className={adminBtn}>Update</button>
            </form>
          </Section>

          <Section title="Delete files">
            <form action={deleteOrderFiles} className="space-y-2">
              <input type="hidden" name="id" value={o.id} />
              <input name="confirm" placeholder="Type DELETE" className={adminInput} aria-label="Type DELETE to confirm" />
              <button className={`${adminBtnDanger} w-full`}>Delete document and receipts</button>
            </form>
          </Section>
        </div>
      </div>
    </>
  );
}
