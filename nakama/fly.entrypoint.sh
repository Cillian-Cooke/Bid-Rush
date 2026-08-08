#!/bin/sh
set -eu

# Prefer explicit Nakama DSN; otherwise convert Fly's DATABASE_URL.
if [ -z "${NAKAMA_DATABASE_ADDRESS:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  # postgres://user:pass@host:5432/db?sslmode=disable
  # → user:pass@host:5432/db?sslmode=disable
  NAKAMA_DATABASE_ADDRESS=$(
    printf '%s' "$DATABASE_URL" | sed -E 's#^postgres(ql)?://##'
  )
  export NAKAMA_DATABASE_ADDRESS
fi

if [ -z "${NAKAMA_DATABASE_ADDRESS:-}" ]; then
  echo "NAKAMA_DATABASE_ADDRESS or DATABASE_URL is required" >&2
  exit 1
fi

echo "Running Nakama migrations..."
/nakama/nakama migrate up --database.address "$NAKAMA_DATABASE_ADDRESS"

echo "Starting Nakama..."
exec /nakama/nakama \
  --config /nakama/data/local.yml \
  --name "${NAKAMA_NODE_NAME:-bid-rush}" \
  --database.address "$NAKAMA_DATABASE_ADDRESS" \
  --logger.level "${NAKAMA_LOG_LEVEL:-INFO}" \
  --session.token_expiry_sec "${NAKAMA_SESSION_EXPIRY:-7200}" \
  --socket.server_key "${NAKAMA_SOCKET_SERVER_KEY:-defaultkey}" \
  --console.username "${NAKAMA_CONSOLE_USERNAME:-admin}" \
  --console.password "${NAKAMA_CONSOLE_PASSWORD:-password}" \
  --runtime.http_key "${NAKAMA_RUNTIME_HTTP_KEY:-defaulthttpkey}" \
  --session.encryption_key "${NAKAMA_SESSION_ENCRYPTION_KEY:-defaultencryptionkey}" \
  --session.refresh_encryption_key "${NAKAMA_SESSION_REFRESH_KEY:-defaultrefreshkey}"
