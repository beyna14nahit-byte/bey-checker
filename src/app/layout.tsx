import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/lib/i18n-server";

export const metadata: Metadata = {
  title: { default: "BY Checker | AI detection report", template: "%s | BY Checker" },
  description: "Order a manually run AI detection report for your document. Clear price, simple DuitNow QR payment.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "ms" ? "ms-MY" : "en-MY"}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
