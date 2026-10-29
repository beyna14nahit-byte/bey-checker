import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminCount, setupTokenConfigured } from "@/lib/setup";

export const metadata: Metadata = { title: "First-time setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Creates the first administrator account without needing a terminal. Disappears (404) as soon as
// any administrator exists.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await adminCount()) > 0) notFound();
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6">
        <h1 className="text-xl font-bold">Create the administrator account</h1>
        {!setupTokenConfigured() ? (
          <p className="mt-3 text-sm text-ink-soft">
            Setup is locked. Add an environment variable named <code>SETUP_TOKEN</code> (at least 16 characters) to your hosting settings, redeploy, then reload this page.
          </p>
        ) : (
          <form method="post" action="/api/admin/setup" className="mt-4 space-y-4">
            <p className="text-sm text-ink-soft">This page works only once. After the account is created it is permanently disabled.</p>
            {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
            <label className="block text-sm font-medium" htmlFor="token">Setup token (the SETUP_TOKEN value)</label>
            <input id="token" name="token" type="password" required className="input" autoComplete="off" />
            <label className="block text-sm font-medium" htmlFor="email">Your email</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="username" />
            <label className="block text-sm font-medium" htmlFor="password">Password (at least 12 characters)</label>
            <input id="password" name="password" type="password" required minLength={12} className="input" autoComplete="new-password" />
            <label className="block text-sm font-medium" htmlFor="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" required minLength={12} className="input" autoComplete="new-password" />
            <button type="submit" className="w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark">Create account</button>
          </form>
        )}
      </div>
    </main>
  );
}
