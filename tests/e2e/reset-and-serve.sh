#!/usr/bin/env bash
# Recreates the local TEST database, migrates and seeds it, and starts the production build on :3200.
set -euo pipefail
: "${TEST_DB_ADMIN_URL:=postgres://postgres@localhost:5433/postgres}"
: "${DATABASE_URL:=postgres://postgres@localhost:5433/bey_test}"
psql "$TEST_DB_ADMIN_URL" -qc "drop database if exists bey_test with (force)" -c "create database bey_test"
DATABASE_URL=$DATABASE_URL npx tsx scripts/migrate.ts
DATABASE_URL=$DATABASE_URL npx tsx scripts/seed.ts
fuser -k 3200/tcp 2>/dev/null || true
sleep 1
DATABASE_URL=$DATABASE_URL SITE_URL=http://localhost:3200 CRON_SECRET="$CRON_SECRET" SETUP_TOKEN="$SETUP_TOKEN" \
  RATE_LIMIT_ORDERS_PER_HOUR=1000 RATE_LIMIT_RECEIPTS_PER_HOUR=1000 nohup npx next start -p 3200 > "${SERVER_LOG:-/dev/null}" 2>&1 &
for i in $(seq 1 30); do curl -sf http://localhost:3200/api/health >/dev/null 2>&1 && break; curl -s -o /dev/null http://localhost:3200/ && break; sleep 1; done
echo "Server ready on :3200"
