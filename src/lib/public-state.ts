import { getQrInfo, getSettings, checkoutBlockers } from "./settings";
import { getQuotes, MAX_DOCUMENTS, nextPriceChange, type Quote } from "./pricing";
import { documentLimitMb, hostLimitMb } from "./files";
import type { Settings } from "./config";

export type PublicState = {
  quotes: Quote[];
  /** Earliest moment any price changes (promotion start or end). */
  changesAt: string | null;
  serverTime: string;
  checkoutOpen: boolean;
  deliveryMethod: Settings["delivery"]["method"];
  turnaroundEn: string;
  turnaroundMs: string;
  formats: string[];
  maxMb: number;
  /** Limit for all documents of one order together. */
  totalMb: number;
  maxDocuments: number;
  paymentWindowHours: number;
  whatsapp: string;
  email: string;
  telegramUrl: string;
};

/** Everything the public pages need, computed fresh on the server for each request. */
export async function getPublicState(now: Date = new Date()): Promise<PublicState & { settings: Settings }> {
  const [settings, qr] = await Promise.all([getSettings(), getQrInfo()]);
  const quotes = getQuotes(settings, now);
  return {
    settings,
    quotes,
    changesAt: nextPriceChange(quotes),
    serverTime: now.toISOString(),
    checkoutOpen: checkoutBlockers(settings, qr).length === 0,
    deliveryMethod: settings.delivery.method,
    turnaroundEn: settings.delivery.turnaroundEn,
    turnaroundMs: settings.delivery.turnaroundMs,
    formats: settings.upload.formats,
    maxMb: documentLimitMb(settings.upload.maxMb),
    totalMb: hostLimitMb(),
    maxDocuments: MAX_DOCUMENTS,
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
