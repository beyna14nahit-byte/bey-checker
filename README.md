# Bey Checker

A small website for ordering a **manually run AI detection report**. Customers upload one document, see the exact price, confirm the order, pay by DuitNow QR and upload their receipt. The owner verifies payment, runs the check by hand and sends the report.

The site does not detect AI itself and never shows detector results.

Stack: Next.js 15, TypeScript, Tailwind CSS v4 (shadcn-compatible `components.json`, `src/components/ui`), PostgreSQL on Supabase, Vercel.

## How it works

- **Pricing** (`src/lib/pricing.ts`) is computed on the server from the saved settings and the server clock.
  - The promotion runs from its start time (inclusive) to its end time (exclusive). At the end time the normal price applies immediately, with no cron job or manual change.
  - Pages are never cached. A page left open refreshes itself at the start or end time.
- **Orders** (`src/lib/orders.ts`):
  - The browser sends the amount the customer reviewed. The server recalculates the price and refuses the order (HTTP 409 with the new price) if the two differ, so the customer must confirm again.
  - Each order stores its accepted amount, normal price, discount, promotion label, promotion end and currency, and keeps them after the promotion ends.
  - A random key per checkout prevents duplicate orders from double clicks or retries.
- **Order pages** (`/order/<reference>?k=<private key>`) need the unguessable key. The reference alone shows nothing.
- **Payment** is manual.
  - Uploading a receipt only sets "Payment under review". The owner verifies or rejects it in the admin area.
  - Checkout is closed until a payment QR, payment instructions (EN and BM) and a contact WhatsApp number are configured.
- **Files** (documents, receipts, QR) are stored in private database tables, served only to a signed-in admin, and kept across deployments.
- **Admin** (`/admin`):
  - orders, payment verification, statuses, notes, settings (prices, promotion, payment, contact, delivery, turnaround, upload formats, retention) and testimonials
  - a launch checklist showing what still needs confirming
- **Testimonials** stay hidden on the website until at least one item with recorded consent is published.
- **Languages**: English and Bahasa Melayu (`src/lib/i18n-ms.ts`), remembered in a cookie. `npm test` fails if a customer-facing string lacks a translation.

## Environment variables (Vercel)

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** URI (port 6543) with your database password. URL-encode `@ # / ? : %` in the password. |
| `DATABASE_SSL` | `require` |
| `SITE_URL` | The real address, no trailing slash, e.g. `https://bey-checker.vercel.app` |
| `CRON_SECRET` | Long random string (16+ characters). Used by the daily file clean-up. |
| `SETUP_TOKEN` | Long random string (16+ characters). Used once to create the admin account. |
| `MAX_UPLOAD_MB` | `4` (Vercel rejects request bodies above about 4.5 MB) |

Optional rate limits: `RATE_LIMIT_ORDERS_PER_HOUR` (default 20), `RATE_LIMIT_RECEIPTS_PER_HOUR` (10), `RATE_LIMIT_LOGIN_FAILURES` (5 per 15 minutes).

## Deploying

1. Create a **new** Supabase project for Bey Checker. Do not reuse the Assignment Support Here database.
2. Import the GitHub repository into Vercel and add the variables above.
3. Deploy. The `vercel-build` script applies migrations (safely, once each) and inserts default settings only if none exist. It never overwrites settings saved in the admin area and never installs a QR.
4. Open `/api/health`. Expect `"database": "connected"` and `"siteUrlMatchesThisHost": true`.
5. Open `/admin/setup`, enter `SETUP_TOKEN` and create your admin account. The page disables itself afterwards.
6. In `/admin/settings`, upload the payment QR and set your WhatsApp number. Checkout opens automatically, and the launch checklist on `/admin` shows anything still missing.

## Local development and tests

```bash
cp .env.example .env
```
```bash
npm install
```
```bash
npm run db:migrate && npm run db:seed && npm run dev
```

- **Unit tests** (pricing boundaries, translations): `npm test`
- **End-to-end tests** (Playwright, against a TEST database): see `tests/e2e/reset-and-serve.sh` and the header of `tests/e2e/run.ts`.
