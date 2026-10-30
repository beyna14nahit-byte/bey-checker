import { NextResponse } from "next/server";
import { ValidationError } from "./orders";
import { UploadError } from "./files";
import { tEn, type T } from "./i18n";

export const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function jsonError(message: string, status = 400, errors?: Record<string, string>, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, errors, ...extra }, { status, headers: NO_STORE });
}

export function handleError(e: unknown, t: T = tEn) {
  if (e instanceof ValidationError) return jsonError(e.message, 422, e.errors);
  if (e instanceof UploadError) return jsonError(e.message, 422, { file: e.message });
  console.error(e instanceof Error ? e.message : e);
  return jsonError(t("Something went wrong on our side and your order was NOT saved. Please try again."), 500);
}

/**
 * Reads a multipart body with a JSON "data" part and up to `maxFiles` "file" parts.
 * `maxMb` limits the whole request (all files together).
 */
export async function readForm(req: Request, maxMb: number, t: T, maxFiles = 1): Promise<{ data: Record<string, unknown>; files: File[] }> {
  const tooBig = maxFiles > 1 ? t("Your files are larger than {mb} MB in total.", { mb: maxMb }) : t("The file is larger than {mb} MB.", { mb: maxMb });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > (maxMb + 0.5) * 1024 * 1024) throw new UploadError(tooBig);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new UploadError(t("The upload could not be read. Please try again."));
  }
  let data: Record<string, unknown> = {};
  try {
    const raw = form.get("data");
    data = typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    throw new ValidationError({ form: t("Please reload the page and try again.") });
  }
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (files.length > maxFiles) throw new UploadError(maxFiles === 1 ? t("Please upload one file only.") : t("Please send at most {n} documents per order.", { n: maxFiles }));
  if (files.reduce((n, f) => n + f.size, 0) > maxMb * 1024 * 1024) throw new UploadError(tooBig);
  return { data, files };
}
