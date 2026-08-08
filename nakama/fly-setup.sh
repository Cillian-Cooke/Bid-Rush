#!/usr/bin/env bash
# Run from repo root after: fly auth login
set -euo pipefail

export PATH="${HOME}/.fly/bin:${PATH}"

APP="${FLY_APP:-bid-rush-nakama}"
DB="${FLY_DB:-bid-rush-db}"
REGION="${FLY_REGION:-lhr}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

if ! fly auth whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: fly auth login"
  exit 1
fi

echo "==> Ensuring app $APP exists"
fly apps create "$APP" 2>/dev/null || echo "App may already exist - continuing"

if ! fly status --app "$DB" >/dev/null 2>&1; then
  echo "==> Creating Postgres $DB in $REGION"
  fly postgres create \
    --name "$DB" \
    --region "$REGION" \
    --vm-size shared-cpu-1x \
    --volume-size 3 \
    --initial-cluster-size 1
else
  echo "==> Postgres $DB already exists"
fi

echo "==> Attaching Postgres to $APP"
fly postgres attach "$DB" --app "$APP" 2>/dev/null || echo "Already attached or attach skipped"

if ! fly secrets list --app "$APP" 2>/dev/null | grep -q NAKAMA_SOCKET_SERVER_KEY; then
  echo "==> Setting Nakama secrets"
  SOCKET_KEY="$(openssl rand -hex 16)"
  CONSOLE_PASS="$(openssl rand -hex 12)"
  fly secrets set --app "$APP" \
    NAKAMA_SOCKET_SERVER_KEY="$SOCKET_KEY" \
    NAKAMA_CONSOLE_USERNAME="admin" \
    NAKAMA_CONSOLE_PASSWORD="$CONSOLE_PASS" \
    NAKAMA_RUNTIME_HTTP_KEY="$(openssl rand -hex 16)" \
    NAKAMA_SESSION_ENCRYPTION_KEY="$(openssl rand -hex 16)" \
    NAKAMA_SESSION_REFRESH_KEY="$(openssl rand -hex 16)"
  echo ""
  echo "IMPORTANT - save these for Vercel:"
  echo "  VITE_NAKAMA_HOST=${APP}.fly.dev"
  echo "  VITE_NAKAMA_PORT=443"
  echo "  VITE_NAKAMA_SERVER_KEY=${SOCKET_KEY}"
  echo "  VITE_NAKAMA_USE_SSL=true"
  echo "  Console password: ${CONSOLE_PASS}"
  echo ""
else
  echo "==> Secrets already set (skipping regenerate)"
fi

echo "==> Deploying Nakama"
fly deploy . --config nakama/fly.toml --dockerfile nakama/Dockerfile --ha=false --app "$APP"

echo ""
echo "Done."
echo "  API:     https://${APP}.fly.dev"
echo "  Console: https://${APP}.fly.dev:8443"
echo "  Logs:    fly logs --app ${APP}"
