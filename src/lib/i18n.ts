import { MS } from "./i18n-ms";

// English text is the translation key: t("Your name") returns the Bahasa Melayu entry when the
// language is "ms", and the English text otherwise. tests/unit/i18n.test.ts checks every t("...")
// call in src/ has a Bahasa Melayu entry.

export type Lang = "en" | "ms";
export const LANG_COOKIE = "byc_lang";
export type Vars = Record<string, string | number>;
export type T = (text: string, vars?: Vars) => string;

export function parseLang(value: unknown): Lang {
  return value === "ms" ? "ms" : "en";
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function translator(lang: Lang): T {
  return (text, vars) => fill(lang === "ms" ? (MS[text] ?? text) : text, vars);
}

/** English-only translator, used where no language is known. */
export const tEn: T = translator("en");

export function intlLocale(lang: Lang): string {
  return lang === "ms" ? "ms-MY" : "en-MY";
}
