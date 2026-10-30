import type { OrderItem, OrderRow } from "./orders";
import { rm } from "./pricing";

type Receipt = { id: string; filename: string } | null;

/**
 * The WhatsApp message a customer sends to the owner after paying. Written in the customer's
 * language. WhatsApp links cannot carry attachments, so it ends with private links the owner taps to
 * open the order and download each file (they work only when signed in to the admin dashboard).
 */
export function ownerMessage(o: Pick<OrderRow, "id" | "reference" | "customer_name" | "whatsapp" | "email" | "amount_due" | "note" | "lang" | "status">, items: OrderItem[], receipt: Receipt, base: string): string {
  const ms = o.lang === "ms";
  const paid = o.status !== "awaiting_payment";
  const lines = [
    ms ? (paid ? "Hai Bey Checker! Saya dah buat pesanan dan bayaran." : "Hai Bey Checker! Saya dah buat pesanan.") : paid ? "Hi Bey Checker! I have placed an order and paid." : "Hi Bey Checker! I have placed an order.",
    "",
    `${ms ? "Rujukan" : "Order"}: ${o.reference}`,
    `${ms ? "Nama" : "Name"}: ${o.customer_name}`,
    `WhatsApp: +${o.whatsapp}`,
    ...(o.email ? [`Email: ${o.email}`] : []),
    "",
    ms ? `Semakan (${items.length} dokumen):` : `Checks (${items.length} document${items.length === 1 ? "" : "s"}):`,
    ...items.map((i) => `${i.position}. ${ms ? i.package_name_ms || i.package_name_en : i.package_name_en} (${rm(i.price)}): ${i.filename}`),
    `${paid ? (ms ? "Jumlah dibayar" : "Total paid") : ms ? "Jumlah" : "Total"}: ${rm(o.amount_due)}`,
    ...(receipt ? [`${ms ? "Resit bayaran" : "Payment receipt"}: ${receipt.filename}`] : []),
    ...(o.note ? [`${ms ? "Nota" : "Note"}: ${o.note.slice(0, 300)}`] : []),
    "",
    paid ? (ms ? "Boleh hantar keputusan saya? Terima kasih!" : "Could you send me my results? Thank you!") : ms ? "Terima kasih!" : "Thank you!",
    "",
    ms ? "Untuk Bey Checker (perlu log masuk admin):" : "For Bey Checker (admin sign-in needed):",
    `${ms ? "Pesanan" : "Order"}: ${base}/admin/orders/${o.id}`,
    ...items.filter((i) => i.file_id).map((i) => `${ms ? "Dokumen" : "Document"} ${i.position}: ${base}/api/admin/files/${i.file_id}`),
    ...(receipt ? [`${ms ? "Resit" : "Receipt"}: ${base}/api/admin/files/${receipt.id}?inline=1`] : []),
  ];
  return lines.join("\n");
}
