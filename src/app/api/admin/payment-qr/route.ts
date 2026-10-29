import { NextResponse } from "next/server";
import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { QR_FORMATS, UploadError, validateFile } from "@/lib/files";

export const dynamic = "force-dynamic";

// Upload, replace or remove the payment QR. The image is stored byte-for-byte, never re-encoded.
export async function POST(req: Request) {
  if (!(await currentAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const back = (msg: string, tone = "ok") => NextResponse.redirect(new URL(`/admin/settings?${tone}=${encodeURIComponent(msg)}#payment`, req.url), 303);
  const form = await req.formData();
  if (form.get("action") === "remove") {
    await db()`delete from site_assets where key = 'payment_qr'`;
    return back("Payment QR removed. Checkout is now closed.");
  }
  const file = form.get("qr");
  if (!(file instanceof File) || file.size === 0) return back("Please choose an image.", "bad");
  try {
    const f = await validateFile(file, QR_FORMATS, 4);
    await db()`insert into site_assets (key, filename, mime, size, sha256, data, updated_at)
      values ('payment_qr', ${f.filename}, ${f.mime}, ${f.size}, ${f.sha256}, ${f.data}, now())
      on conflict (key) do update set filename = excluded.filename, mime = excluded.mime, size = excluded.size,
        sha256 = excluded.sha256, data = excluded.data, updated_at = now()`;
    return back(`Payment QR saved (${f.filename}).`);
  } catch (e) {
    return back(e instanceof UploadError ? e.message : "Upload failed.", "bad");
  }
}
