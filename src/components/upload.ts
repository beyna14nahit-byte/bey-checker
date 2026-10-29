import { tEn, type T } from "@/lib/i18n";
import type { Quote } from "@/lib/pricing";

export type ApiResult<R> = ({ ok: true } & R) | { ok: false; message: string; errors?: Record<string, string>; code?: string; quote?: Quote };

/** Posts JSON data plus one file with upload progress (0-100). */
export function postForm<R>(url: string, data: unknown, file: File | null, onProgress?: (pct: number) => void, t: T = tEn): Promise<ApiResult<R>> {
  const form = new FormData();
  form.append("data", JSON.stringify(data));
  if (file) form.append("file", file, file.name);
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response;
      if (body && typeof body === "object" && "ok" in body) resolve(body as ApiResult<R>);
      else if (xhr.status === 413) resolve({ ok: false, message: t("The file is too large to upload.") });
      else resolve({ ok: false, message: t("Unexpected server response ({status}). Nothing was saved. Please try again.", { status: xhr.status }) });
    };
    xhr.onerror = () => resolve({ ok: false, message: t("Network error. Please check your connection and try again.") });
    xhr.send(form);
  });
}
