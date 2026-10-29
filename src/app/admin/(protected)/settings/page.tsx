import { getQrInfo, getSettings } from "@/lib/settings";
import { getQuotes, rm } from "@/lib/pricing";
import { UPLOAD_FORMATS } from "@/lib/config";
import { isoToMyLocalInput, formatMy } from "@/lib/time";
import { hostLimitMb } from "@/lib/files";
import { Flash, adminBtn, adminBtnSecondary, adminInput } from "@/components/admin";
import { runRetention, saveSettingsAction } from "../../actions";

function Group({ title, id, children, note }: { title: string; id?: string; children: React.ReactNode; note?: string }) {
  return (
    <fieldset id={id} className="scroll-mt-6 rounded-2xl border border-line bg-white p-5">
      <legend className="px-1 font-semibold">{title}</legend>
      {note && <p className="mb-3 text-sm text-muted">{note}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block text-sm font-medium ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const check = "flex items-center gap-2 text-sm font-medium";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; bad?: string }> }) {
  const sp = await searchParams;
  const [s, qr] = await Promise.all([getSettings(), getQrInfo()]);
  const quotes = getQuotes(s);
  const promo = quotes.find((x) => x.promo)?.promo ?? null;
  const p = s.promotion;
  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-muted">Times are Malaysia time (GMT+8). Prices now: <strong>{quotes.map((q) => `${q.nameEn} ${rm(q.finalPrice)}`).join(" · ")}</strong>{promo ? ` (promotion until ${formatMy(promo.endsAt)})` : ""}.</p>
      <Flash ok={sp.ok} bad={sp.bad} />

      <section id="payment" className="mb-6 scroll-mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Payment QR</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-[200px_1fr]">
          {qr.configured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/payment-qr?v=${qr.version}`} alt="Current payment QR" className="w-full rounded-xl border border-line" data-testid="admin-qr" />
          ) : (
            <p className="rounded-xl bg-warn-soft p-4 text-sm text-warn">No QR uploaded. Checkout is closed.</p>
          )}
          <div>
            <form method="post" action="/api/admin/payment-qr" encType="multipart/form-data" className="space-y-2">
              <input name="qr" type="file" accept=".png,.jpg,.jpeg,.webp" required className="block w-full text-sm" aria-label="QR image" />
              <p className="text-xs text-muted">PNG, JPG or WEBP up to 4 MB. Upload the original image from your bank; it is stored exactly as uploaded.</p>
              <button className={adminBtn}>{qr.configured ? "Replace QR" : "Upload QR"}</button>
            </form>
            {qr.configured && (
              <form method="post" action="/api/admin/payment-qr" className="mt-3">
                <input type="hidden" name="action" value="remove" />
                <button className="text-xs font-semibold text-bad hover:underline">Remove QR (closes checkout)</button>
              </form>
            )}
          </div>
        </div>
      </section>

      <form action={saveSettingsAction} className="space-y-6" data-testid="settings-form">
        <Group title="Packages (MYR, per document)" note="Untick a package to hide it from customers. Each package has its own normal and promotional price.">
          {s.packages.map((pk) => (
            <div key={pk.id} className="grid gap-3 rounded-xl border border-line p-3 sm:col-span-2 sm:grid-cols-2">
              <label className={`${check} sm:col-span-2`}><input type="checkbox" name={`pkg_${pk.id}_enabled`} defaultChecked={pk.enabled} className="h-4 w-4" /> Offer this package</label>
              <F label="Name (English)"><input name={`pkg_${pk.id}_nameEn`} defaultValue={pk.nameEn} className={adminInput} /></F>
              <F label="Name (Bahasa Melayu)"><input name={`pkg_${pk.id}_nameMs`} defaultValue={pk.nameMs} className={adminInput} /></F>
              <F label="Normal price (RM)"><input name={`pkg_${pk.id}_normal`} defaultValue={pk.normalPrice} inputMode="decimal" className={adminInput} /></F>
              <F label="Promotional price (RM)"><input name={`pkg_${pk.id}_promo`} defaultValue={pk.promoPrice} inputMode="decimal" className={adminInput} /></F>
            </div>
          ))}
        </Group>

        <Group title="Promotion" note="The promotional price applies from the start time until the end time. At the end time the normal price applies automatically. Orders already placed keep their recorded price.">
          <label className={`${check} sm:col-span-2`}><input type="checkbox" name="promoEnabled" defaultChecked={p.enabled} className="h-4 w-4" /> Promotion enabled</label>
          <F label="Label (English)"><input name="promoLabelEn" defaultValue={p.labelEn} className={adminInput} /></F>
          <F label="Label (Bahasa Melayu)"><input name="promoLabelMs" defaultValue={p.labelMs} className={adminInput} /></F>
          <F label="Starts (Malaysia time)"><input type="datetime-local" name="promoStart" defaultValue={p.startsAt ? isoToMyLocalInput(p.startsAt) : ""} className={adminInput} /></F>
          <F label="Ends (Malaysia time, normal price from this minute)"><input type="datetime-local" name="promoEnd" defaultValue={p.endsAt ? isoToMyLocalInput(p.endsAt) : ""} className={adminInput} /></F>
        </Group>

        <Group title="Payment">
          <F label="Payment method label"><input name="provider" defaultValue={s.payment.provider} className={adminInput} /></F>
          <F label="Payment deadline in hours (0 = no deadline)"><input name="windowHours" defaultValue={s.payment.windowHours} inputMode="numeric" className={adminInput} /></F>
          <F label="Instructions (English)" wide><textarea name="instructionsEn" defaultValue={s.payment.instructionsEn} rows={5} className={adminInput} /></F>
          <F label="Instructions (Bahasa Melayu)" wide><textarea name="instructionsMs" defaultValue={s.payment.instructionsMs} rows={5} className={adminInput} /></F>
        </Group>

        <Group title="Contact">
          <F label="WhatsApp number with country code"><input name="whatsapp" defaultValue={s.contact.whatsapp} placeholder="60123456789" className={adminInput} /></F>
          <F label="Email (optional)"><input name="email" defaultValue={s.contact.email} className={adminInput} /></F>
          <F label="Telegram link (optional)"><input name="telegramUrl" defaultValue={s.contact.telegramUrl} placeholder="https://t.me/username" className={adminInput} /></F>
        </Group>

        <Group title="Report delivery and turnaround" note="Turnaround is shown to customers only when filled in.">
          <F label="Delivery method">
            <select name="deliveryMethod" defaultValue={s.delivery.method} className={adminInput}>
              <option value="whatsapp">WhatsApp (no email field)</option>
              <option value="email">Email (email required at checkout)</option>
            </select>
          </F>
          <div />
          <F label="Turnaround (English), e.g. Within 24 hours"><input name="turnaroundEn" defaultValue={s.delivery.turnaroundEn} className={adminInput} /></F>
          <F label="Turnaround (Bahasa Melayu), e.g. Dalam masa 24 jam"><input name="turnaroundMs" defaultValue={s.delivery.turnaroundMs} className={adminInput} /></F>
        </Group>

        <Group title="Document uploads" note={`Choose the formats your checking tool accepts. The hosting limit is ${hostLimitMb()} MB.`}>
          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {UPLOAD_FORMATS.map((f) => (
              <label key={f} className={check}><input type="checkbox" name={`format_${f}`} defaultChecked={s.upload.formats.includes(f)} className="h-4 w-4" /> {f.toUpperCase()}</label>
            ))}
          </div>
          <F label="Maximum file size (MB)"><input name="maxMb" defaultValue={s.upload.maxMb} inputMode="decimal" className={adminInput} /></F>
          <label className={`${check} self-end`}><input type="checkbox" name="uploadRulesConfirmed" defaultChecked={s.launch.uploadRulesConfirmed} className="h-4 w-4" /> I confirm these formats and limits</label>
        </Group>

        <Group title="File retention" id="retention">
          <F label="Delete files this many days after an order is completed or cancelled"><input name="retentionDays" defaultValue={s.retention.days} inputMode="numeric" className={adminInput} /></F>
          <label className={`${check} self-end`}><input type="checkbox" name="retentionConfirmed" defaultChecked={s.retention.confirmed} className="h-4 w-4" /> I confirm this policy (shown on the terms page)</label>
        </Group>

        <button className={adminBtn}>Save settings</button>
      </form>
      <form action={runRetention} className="mt-4"><button className={adminBtnSecondary}>Run file clean-up now</button></form>
    </>
  );
}
