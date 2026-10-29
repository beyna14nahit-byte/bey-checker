import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// The owner's payment QR, served exactly as uploaded. 404 when none is configured.
export async function GET() {
  const rows = await db()<{ mime: string; data: Buffer; sha256: string }[]>`select mime, data, sha256 from site_assets where key = 'payment_qr'`;
  const qr = rows[0];
  if (!qr) return new Response("Payment QR not configured", { status: 404 });
  return new Response(new Uint8Array(qr.data), {
    headers: { "Content-Type": qr.mime, "Content-Length": String(qr.data.length), "Cache-Control": "public, max-age=300", ETag: `"${qr.sha256}"` },
  });
}
