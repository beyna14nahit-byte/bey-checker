// Malaysia does not observe daylight saving, so Asia/Kuala_Lumpur is always UTC+08:00.
export const MY_TZ = "Asia/Kuala_Lumpur";
const MY_OFFSET = "+08:00";
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Parses a datetime-local value ("2026-11-02T18:00") as Malaysia time. */
export function parseMyLocal(value: string): Date | null {
  const m = LOCAL_RE.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${value.trim()}:00${MY_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject rolled-over values such as 2026-02-31.
  if (toMyLocalInput(d) !== value.trim()) return null;
  return d;
}

/** Formats a date as a datetime-local value in Malaysia time. */
export function toMyLocalInput(d: Date): string {
  return new Date(d.getTime() + MY_OFFSET_MS).toISOString().slice(0, 16);
}

/** Today's date in Malaysia as YYYY-MM-DD. */
export function todayMy(now: Date = new Date()): string {
  return toMyLocalInput(now).slice(0, 10);
}

export function myWeekday(dateYmd: string): number {
  return new Date(`${dateYmd}T12:00:00${MY_OFFSET}`).getUTCDay();
}

export function formatMy(d: Date | string | null | undefined, withTime = true, locale = "en-MY"): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    timeZone: MY_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit", hour12: true } : {}),
  }).format(date);
}

/** Converts an admin-entered datetime-local promotion value to an ISO string with +08:00. */
export function myLocalToIso(value: string): string | null {
  const d = parseMyLocal(value);
  return d ? `${value}:00${MY_OFFSET}` : null;
}

export function isoToMyLocalInput(iso: string): string {
  return toMyLocalInput(new Date(iso));
}
