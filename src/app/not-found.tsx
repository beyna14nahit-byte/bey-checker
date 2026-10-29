import Link from "next/link";
import { getT } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">{t("Page not found")}</h1>
      <Link href="/" className="mt-6 inline-block font-semibold text-brand hover:underline">{t("Back to BY Checker")}</Link>
    </main>
  );
}
