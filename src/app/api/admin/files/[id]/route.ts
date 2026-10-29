import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isImage } from "@/lib/files";

export const dynamic = "force-dynamic";

// Customer documents and receipts are only served through this authenticated route.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return new Response("Unauthorised", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const rows = await db()<{ filename: string; mime: string; data: Buffer }[]>`select filename, mime, data from files where id = ${id}`;
  const f = rows[0];
  if (!f) return new Response("Not found", { status: 404 });
  const inline = new URL(req.url).searchParams.get("inline") === "1" && isImage(f.mime);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": inline ? f.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
