#!/bin/bash

# 1. Указываем URL devnet
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com

# 2. Указываем путь к кошельку devnet
export ANCHOR_WALLET="$HOME/.config/solana/devnet.json"

# 3. Запускаем demo.ts через tsx
npx tsx scripts/demo.ts
