import { createHash } from "node:crypto";
import type { UploadFormat } from "./config";
import { tEn, type T } from "./i18n";

// Server-side upload validation: the type is decided by the extension AND the file's own leading
// bytes. The browser's MIME type is never trusted.

export const RECEIPT_FORMATS = ["png", "jpg", "jpeg", "webp", "pdf"] as const;
export const QR_FORMATS = ["png", "jpg", "jpeg", "webp"] as const;

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Hosting limit for one request body (Vercel rejects bodies above about 4.5 MB). */
export function hostLimitMb(): number {
  const n = Number(process.env.MAX_UPLOAD_MB || 4);
  return n > 0 ? n : 4;
}

function starts(buf: Buffer, bytes: number[], offset = 0) {
  return buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
}

function signatureOk(ext: string, buf: Buffer): boolean {
  switch (ext) {
    case "pdf":
      return starts(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "docx":
      return starts(buf, [0x50, 0x4b, 0x03, 0x04]);
    case "doc":
      return starts(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case "png":
      return starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return starts(buf, [0xff, 0xd8, 0xff]);
    case "webp":
      return starts(buf, [0x52, 0x49, 0x46, 0x46]) && starts(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case "txt":
      if (buf.includes(0)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buf);
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function sanitiseFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").replace(/\s+/g, " ").trim() || "file";
  if (cleaned.length <= 150) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 150 - ext.length) + ext;
}

export class UploadError extends Error {}

export type ValidFile = { filename: string; mime: string; size: number; sha256: string; data: Buffer };

export async function validateFile(file: File, allowed: readonly string[], maxMb: number, t: T = tEn): Promise<ValidFile> {
  const filename = sanitiseFilename(file.name || "file");
  const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const types = allowed.map((e) => e.toUpperCase()).join(", ");
  if (!allowed.includes(ext)) throw new UploadError(t("This file type is not accepted. Accepted formats: {types}.", { types }));
  if (file.size === 0) throw new UploadError(t("The file is empty."));
  if (file.size > maxMb * 1024 * 1024) throw new UploadError(t("The file is larger than {mb} MB.", { mb: maxMb }));
  const data = Buffer.from(await file.arrayBuffer());
  if (!signatureOk(ext, data)) throw new UploadError(t("The file does not look like a valid {type} file.", { type: ext.toUpperCase() }));
  return { filename, mime: MIME[ext], size: data.length, sha256: createHash("sha256").update(data).digest("hex"), data };
}

export function isImage(mime: string) {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

/** Upload formats allowed for documents, limited to what the host can accept. */
export function documentLimitMb(settingsMaxMb: number): number {
  return Math.min(settingsMaxMb, hostLimitMb());
}

export type { UploadFormat };
