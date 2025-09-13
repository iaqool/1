#!/usr/bin/env bash
set -euo pipefail

# Load root .env if present (for FUND_WALLET_SECRET, RPC_URL, etc.)
if [[ -f ./.env ]]; then
  set -a
  source ./.env
  set +a
fi

# Config
PORT=${PORT:-3000}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:5173}
RPC_URL=${RPC_URL:-https://api.devnet.solana.com}
VITE_PROGRAM_ID=${VITE_PROGRAM_ID:-Gk85ZcvrXHUsYB255MCKHpwcUc8gPp6vSYbHjtUGKxpD}
VITE_RPC_URL=${VITE_RPC_URL:-$RPC_URL}
VITE_LINK_SERVER_URL=${VITE_LINK_SERVER_URL:-http://localhost:3000}

echo "=== SkinSol local demo ==="
echo "Server:       http://localhost:${PORT}"
echo "Frontend:     ${FRONTEND_URL}"
echo "RPC_URL:      ${RPC_URL}"
echo "PROGRAM_ID:   ${VITE_PROGRAM_ID}"
if [[ -z "${FUND_WALLET_SECRET:-}" ]]; then
  echo "WARN: FUND_WALLET_SECRET is not set. /credit/transfer API will return an error until you export it."
fi

cleanup() {
  echo "\nShutting down local demo..."
  [[ -n "${SERVER_PID:-}" ]] && kill ${SERVER_PID} >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Install deps if needed and start server
echo "\n-> Starting link/credit server on :${PORT}"
pushd "$(dirname "$0")/../app/server" >/dev/null
npm i >/dev/null 2>&1 || npm i
PORT=${PORT} FRONTEND_URL=${FRONTEND_URL} RPC_URL=${RPC_URL} FUND_WALLET_SECRET=${FUND_WALLET_SECRET:-} npm run dev &
SERVER_PID=$!
popd >/dev/null

# Start web dev server (foreground)
echo "\n-> Starting web dev on :5173"
pushd "$(dirname "$0")/../app/web" >/dev/null
npm i >/dev/null 2>&1 || npm i
VITE_PROGRAM_ID=${VITE_PROGRAM_ID} VITE_RPC_URL=${VITE_RPC_URL} VITE_LINK_SERVER_URL=${VITE_LINK_SERVER_URL} npm run dev
popd >/dev/null
