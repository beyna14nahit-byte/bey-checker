export function digitsOnly(v: string): string {
  return v.replace(/\D/g, "");
}

/** Accepts numbers with a country code. A leading 0 is treated as Malaysian (+60). */
export function normalisePhone(v: string): string | null {
  let d = digitsOnly(v);
  if (d.startsWith("0")) d = `6${d}`;
  return d.length >= 9 && d.length <= 15 ? d : null;
}

export function waLink(number: string, text?: string): string {
  const base = `https://wa.me/${digitsOnly(number)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function validEmail(v: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) && v.length <= 200;
}
