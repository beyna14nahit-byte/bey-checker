import { NextResponse } from "next/server";
import { getT } from "@/lib/i18n-server";
import { getQrInfo, getSettings, checkoutBlockers } from "@/lib/settings";
import { createOrder, orderPath, PriceChangedError, validateOrderInput } from "@/lib/orders";
import { documentLimitMb, hostLimitMb, sanitiseFilename, UploadError, validateFile, type ValidFile } from "@/lib/files";
import { basketForClient, MAX_DOCUMENTS } from "@/lib/pricing";
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
    const { data, files } = await readForm(req, hostLimitMb(), t, MAX_DOCUMENTS);
    const input = validateOrderInput(data, settings, files.length, t);
    const valid: ValidFile[] = [];
    for (const file of files) {
      try {
        valid.push(await validateFile(file, settings.upload.formats, maxMb, t));
      } catch (e) {
        // Say which document is the problem when there are several.
        if (e instanceof UploadError && files.length > 1) throw new UploadError(`${sanitiseFilename(file.name)}: ${e.message}`);
        throw e;
      }
    }
    try {
      const order = await createOrder(input, valid, settings, lang);
      return NextResponse.json(
        { ok: true, reference: order.reference, orderUrl: orderPath(order.reference, order.access_token), amountDue: Number(order.amount_due), duplicate: order.duplicate },
        { headers: NO_STORE },
      );
    } catch (e) {
      if (e instanceof PriceChangedError) {
        return jsonError(t("The price has changed. Please review the new amount and confirm again."), 409, undefined, { code: "price_changed", basket: basketForClient(e.basket), quote: e.basket.items.length === 1 ? e.basket.items[0] : undefined });
      }
      throw e;
    }
  } catch (e) {
    return handleError(e, t);
  }
}
