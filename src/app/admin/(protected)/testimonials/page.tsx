import { db } from "@/lib/db";
import { formatMy } from "@/lib/time";
import { Flash, adminBtn, adminBtnDanger, adminInput } from "@/components/admin";
import { deleteTestimonial, saveTestimonial } from "../../actions";

type Row = { id: string; created_at: Date; display_name: string; feedback: string; rating: number | null; consent_confirmed: boolean; published: boolean };

function Fields({ r }: { r?: Row }) {
  return (
    <>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <input name="displayName" defaultValue={r?.display_name} placeholder="Display name, e.g. Aina, UiTM" className={adminInput} aria-label="Display name" />
        <select name="rating" defaultValue={r?.rating ?? ""} className={adminInput} aria-label="Rating">
          <option value="">No rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} / 5</option>)}
        </select>
      </div>
      <textarea name="feedback" defaultValue={r?.feedback} rows={3} placeholder="Customer's own words" className={`${adminInput} mt-3`} aria-label="Feedback" />
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="consent" defaultChecked={r?.consent_confirmed} className="h-4 w-4" /> Customer agreed to publication</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="published" defaultChecked={r?.published} className="h-4 w-4" /> Published</label>
      </div>
    </>
  );
}

export default async function TestimonialsPage({ searchParams }: { searchParams: Promise<{ ok?: string; bad?: string }> }) {
  const sp = await searchParams;
  const rows = await db()<Row[]>`select * from testimonials order by created_at desc`;
  const live = rows.filter((r) => r.published && r.consent_confirmed).length;
  return (
    <>
      <h1 className="text-2xl font-bold">Testimonials</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Add only genuine feedback with the customer&apos;s consent. The section stays hidden on the website until at least one item is published ({live} published now).
      </p>
      <Flash ok={sp.ok} bad={sp.bad} />
      <form action={saveTestimonial} className="mb-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-semibold">Add feedback</h2>
        <Fields />
        <button className={`${adminBtn} mt-4`}>Save</button>
      </form>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-3 text-xs text-muted">Added {formatMy(r.created_at)} · {r.published ? "Published" : "Hidden"}</p>
            <form action={saveTestimonial}>
              <Fields r={r} />
              <button className={`${adminBtn} mt-4`}>Update</button>
            </form>
            <form action={deleteTestimonial} className="mt-2">
              <input type="hidden" name="id" value={r.id} />
              <button className={adminBtnDanger}>Delete</button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
