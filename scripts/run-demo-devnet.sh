#!/usr/bin/env bash
set -euo pipefail

echo "== SkinSol demo on Devnet =="

PROGRAM_ID="Gk85ZcvrXHUsYB255MCKHpwcUc8gPp6vSYbHjtUGKxpD"
export PROGRAM_ID
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export USE_DEVNET=1

DEVNET_WALLET="${HOME}/.config/solana/devnet.json"
export ANCHOR_WALLET="$DEVNET_WALLET"

if command -v solana >/dev/null 2>&1; then
  mkdir -p "$(dirname "$DEVNET_WALLET")"
  if [ ! -f "$DEVNET_WALLET" ]; then
    echo "-- Creating devnet keypair at $DEVNET_WALLET"
    solana-keygen new -o "$DEVNET_WALLET" -s -q || true
  fi
  echo "-- Using wallet: $(solana address -k "$DEVNET_WALLET" 2>/dev/null || echo unknown)"
  echo "-- Airdrop 1 SOL (if allowed)"
  solana airdrop 1 --url https://api.devnet.solana.com || true
else
  echo "!! solana CLI not found. Skipping keypair/airdrop steps."
fi

echo "-- Running demo script (idempotent)"
npm run demo:devnet

cat <<EOF

Next steps:
- Start web UI (dev): npm run web:dev
- Open http://localhost:5173
- Flow: Connect wallet → Init Vault → Deposit 100 → Mint NFT → List → Rent → Fetch

Program ID: $PROGRAM_ID
RPC: https://api.devnet.solana.com
EOF
