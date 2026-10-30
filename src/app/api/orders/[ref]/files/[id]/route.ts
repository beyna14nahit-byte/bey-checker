import { db } from "@/lib/db";
import { getOrderForCustomer } from "@/lib/orders";

export const dynamic = "force-dynamic";

// Lets the customer fetch their own uploads again (to share them on WhatsApp from their phone).
// Needs the order's private access key, and only serves files of that order.
export async function GET(req: Request, ctx: { params: Promise<{ ref: string; id: string }> }) {
  const { ref, id } = await ctx.params;
  const k = new URL(req.url).searchParams.get("k") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const order = await getOrderForCustomer(decodeURIComponent(ref), k);
  if (!order) return new Response("Not found", { status: 404 });
  const rows = await db()<{ filename: string; mime: string; data: Buffer }[]>`
    select filename, mime, data from files where id = ${id} and order_id = ${order.id}`;
  const f = rows[0];
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
