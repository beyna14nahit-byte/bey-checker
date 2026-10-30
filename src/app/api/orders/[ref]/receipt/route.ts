import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n-server";
import { canUploadReceipt, getOrderForCustomer, ValidationError } from "@/lib/orders";
import { RECEIPT_FORMATS, hostLimitMb, validateFile } from "@/lib/files";
import { handleError, jsonError, NO_STORE, readForm } from "@/lib/http";
import { clientIp, consume } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Proof of payment only moves the order to "Payment under review". The owner verifies it manually.
export async function POST(req: Request, ctx: { params: Promise<{ ref: string }> }) {
  const { t } = await getT();
  try {
    if (!(await consume("receipt", clientIp(req)))) return jsonError(t("Too many attempts from your connection. Please wait an hour or contact us."), 429);
    const { ref } = await ctx.params;
    const maxMb = Math.min(4, hostLimitMb());
    const { data, files } = await readForm(req, maxMb, t);
    const file = files[0];
    const order = await getOrderForCustomer(ref, typeof data.k === "string" ? data.k : "");
    if (!order) return jsonError(t("Order not found. Please use the private link from your order confirmation."), 404);
    if (!canUploadReceipt(order)) return jsonError(t("This order is not accepting payment receipts. Please contact us."), 409);
    if (!file) throw new ValidationError({ file: t("Please choose your payment receipt.") });
    const f = await validateFile(file, RECEIPT_FORMATS, maxMb, t);
    const paymentRef = typeof data.paymentReference === "string" ? data.paymentReference.trim().slice(0, 100) : "";
    await db().begin(async (tx) => {
      await tx`insert into files (order_id, kind, filename, mime, size, sha256, data) values (${order.id}, 'receipt', ${f.filename}, ${f.mime}, ${f.size}, ${f.sha256}, ${f.data})`;
      await tx`update orders set status = 'payment_review', receipt_uploaded_at = now(), payment_reference = ${paymentRef || null}, updated_at = now() where id = ${order.id}`;
      await tx`insert into events (order_id, actor, message) values (${order.id}, 'customer', ${`Payment receipt uploaded (${f.filename}).`})`;
    });
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    return handleError(e, t);
  }
}
