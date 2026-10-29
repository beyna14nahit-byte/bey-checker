import { cookies } from "next/headers";
import { LANG_COOKIE, parseLang, translator, type Lang, type T } from "./i18n";

export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}

export async function getT(): Promise<{ lang: Lang; t: T }> {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
