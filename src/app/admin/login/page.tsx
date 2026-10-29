import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentAdmin()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form method="post" action="/api/admin/login" className="w-full max-w-sm rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-bold">Administrator sign in</h1>
        <p className="mt-1 text-sm text-muted">BY Checker dashboard</p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <label className="mt-5 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input mt-1" />
        <label className="mt-4 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input mt-1" />
        <button type="submit" className="mt-6 w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark">Sign in</button>
      </form>
    </main>
  );
}
