#!/bin/bash
set -e

echo "🔹 Step 1: Running tests..."
anchor test --provider.cluster localnet

echo "🔹 Step 2: Building program..."
anchor build

echo "🔹 Step 3: Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo "✅ Deployment finished!"
