import { getQrInfo, getSettings, checkoutBlockers } from "./settings";
import { getQuote, type Quote } from "./pricing";
import { documentLimitMb } from "./files";
import type { Settings } from "./config";

export type PublicState = {
  quote: Quote;
  serverTime: string;
  checkoutOpen: boolean;
  deliveryMethod: Settings["delivery"]["method"];
  turnaroundEn: string;
  turnaroundMs: string;
  formats: string[];
  maxMb: number;
  paymentWindowHours: number;
  whatsapp: string;
  email: string;
  telegramUrl: string;
};

/** Everything the public pages need, computed fresh on the server for each request. */
export async function getPublicState(now: Date = new Date()): Promise<PublicState & { settings: Settings }> {
  const [settings, qr] = await Promise.all([getSettings(), getQrInfo()]);
  return {
    settings,
    quote: getQuote(settings, now),
    serverTime: now.toISOString(),
    checkoutOpen: checkoutBlockers(settings, qr).length === 0,
    deliveryMethod: settings.delivery.method,
    turnaroundEn: settings.delivery.turnaroundEn,
    turnaroundMs: settings.delivery.turnaroundMs,
    formats: settings.upload.formats,
    maxMb: documentLimitMb(settings.upload.maxMb),
    paymentWindowHours: settings.payment.windowHours,
    whatsapp: settings.contact.whatsapp,
    email: settings.contact.email,
    telegramUrl: settings.contact.telegramUrl,
  };
}

export function toClientState(s: PublicState & { settings?: Settings }): PublicState {
  const { settings: _omit, ...rest } = s;
  void _omit;
  return rest;
}
