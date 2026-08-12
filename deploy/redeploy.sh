#!/usr/bin/env bash
# deploy/redeploy.sh
# ─────────────────────────────────────────────────────────────
# Pulls latest code, applies any new migrations, rebuilds, and
# restarts the PM2-managed server. Run from anywhere; it cd's into
# the repo root itself. See deploy/README.md "Güncelleme / yeniden
# deploy" for what this does step by step and why.
#
# USAGE: bash deploy/redeploy.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Applying database migrations..."
(cd server && pnpm exec prisma generate && pnpm exec prisma migrate deploy)

echo "==> Building web + server..."
pnpm turbo run build --filter=@pazariopos/web --filter=@pazariopos/server

echo "==> Restarting server..."
pm2 restart pazariopos-server

echo "==> Done. Tailing logs (Ctrl+C to exit)..."
pm2 logs pazariopos-server --lines 20
