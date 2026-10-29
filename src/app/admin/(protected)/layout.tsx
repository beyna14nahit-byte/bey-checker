import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium" aria-label="Admin">
            <span className="mr-3 font-extrabold">BY Checker admin</span>
            <Link href="/admin" className="rounded-lg px-2.5 py-1.5 hover:bg-secondary">Orders</Link>
            <Link href="/admin/settings" className="rounded-lg px-2.5 py-1.5 hover:bg-secondary">Settings</Link>
            <Link href="/admin/testimonials" className="rounded-lg px-2.5 py-1.5 hover:bg-secondary">Testimonials</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{admin.email}</span>
            <Link href="/" target="_blank" className="text-brand hover:underline">View site</Link>
            <form method="post" action="/api/admin/logout"><button className="rounded-lg border border-line px-3 py-1.5 font-medium hover:border-brand">Sign out</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}
