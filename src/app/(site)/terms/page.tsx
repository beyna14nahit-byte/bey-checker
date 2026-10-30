import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { getSettings } from "@/lib/settings";
import { Container } from "@/components/ui/card";

export const metadata: Metadata = { title: "Terms & privacy" };

export default async function TermsPage() {
  const [{ t }, s] = await Promise.all([getT(), getSettings()]);
  const delivery = s.delivery.method === "email" ? t("by email") : t("on WhatsApp");
  const sections: [string, string[]][] = [
    [
      t("The service"),
      [
        t("Bey Checker is a manual service. After your payment is verified, a person runs your document through the checking tool for the package you chose (AI detection, similarity, or both) and sends you the report {delivery}.", { delivery }),
        t("Uploading a document does not check it automatically, and this website does not generate detection results by itself."),
        t("Each document in an order is priced by the check you choose for it. The amount shown before you confirm is the amount you pay."),
      ],
    ],
    [
      t("About the results"),
      [
        t("AI detection results are indicators only. They cannot prove whether a person or an AI wrote a document."),
        t("A similarity report shows text that matches other sources. A match is not proof of plagiarism by itself; quotes and references can also match."),
        t("We do not guarantee any particular AI percentage, grade or academic outcome."),
        t("You remain responsible for how you use the report and for following your institution's rules."),
      ],
    ],
    [
      t("Payment"),
      [
        t("Payment is made manually by DuitNow QR. Your order shows \"Payment under review\" until we check your receipt. Uploading a receipt does not confirm payment by itself."),
        t("We will never ask for your banking password, PIN or TAC."),
      ],
    ],
    [
      t("What we collect and why"),
      [
        t("Your name, WhatsApp number, email if needed for delivery, your document, your note and your payment receipt."),
        t("We use them only to process your order, verify your payment and deliver your report."),
        t("To prevent spam we keep a one-way hash of your internet (IP) address for about a day."),
      ],
    ],
    [
      t("How files are protected"),
      [
        t("Documents and receipts are stored in a private database. They are never available through public links."),
        t("Only our administrator can open them, through a password-protected dashboard."),
        t("WhatsApp messages from this website contain your order reference only, never your document."),
      ],
    ],
    [
      t("How long we keep files"),
      [
        s.retention.confirmed
          ? t("We delete your document and receipt {days} days after your order is completed or cancelled. We keep the basic order record (reference, amount and status) for our accounts.", { days: s.retention.days })
          : t("Our retention period is being finalised. Until then we keep files only as long as needed for your order."),
        t("You can ask us to delete your files at any time by contacting us with your order reference."),
      ],
    ],
  ];
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold">{t("Terms & privacy")}</h1>
      <div className="mt-8 space-y-8">
        {sections.map(([title, items]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold">{title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              {items.map((i) => <li key={i} className="leading-relaxed">{i}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </Container>
  );
}
