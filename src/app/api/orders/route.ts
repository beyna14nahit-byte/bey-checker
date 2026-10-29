import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { getQrInfo, getSettings, checkoutBlockers } from "@/lib/settings";
import { createOrder, orderPath, PriceChangedError, validateOrderInput } from "@/lib/orders";
import { documentLimitMb, validateFile } from "@/lib/files";
import { handleError, jsonError, NO_STORE, readForm } from "@/lib/http";
import { clientIp, consume } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { lang, t } = await getT();
  try {
    const [settings, qr] = await Promise.all([getSettings(), getQrInfo()]);
    if (checkoutBlockers(settings, qr).length) return jsonError(t("Ordering is temporarily unavailable. Please contact us."), 503);
    if (!(await consume("order", clientIp(req)))) return jsonError(t("Too many attempts from your connection. Please wait an hour or contact us."), 429);
    const maxMb = documentLimitMb(settings.upload.maxMb);
    const { data, file } = await readForm(req, maxMb, t);
    const input = validateOrderInput(data, settings, !!file, t);
    const valid = await validateFile(file!, settings.upload.formats, maxMb, t);
    try {
      const order = await createOrder(input, valid, settings, lang);
      return NextResponse.json(
        { ok: true, reference: order.reference, orderUrl: orderPath(order.reference, order.access_token), amountDue: Number(order.amount_due), duplicate: order.duplicate },
        { headers: NO_STORE },
      );
    } catch (e) {
      if (e instanceof PriceChangedError) {
        return jsonError(t("The price has changed. Please review the new amount and confirm again."), 409, undefined, { code: "price_changed", quote: e.quote });
      }
      throw e;
    }
  } catch (e) {
    return handleError(e, t);
  }
}
