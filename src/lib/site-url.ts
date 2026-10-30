import { headers } from "next/headers";

/** This site's address for links in messages: SITE_URL when set, otherwise the request's host. */
export async function siteBase(): Promise<string> {
  const fixed = process.env.SITE_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}
