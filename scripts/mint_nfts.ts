import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Metaplex, keypairIdentity } from '@metaplex-foundation/js';

async function main() {
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com';
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/devnet.json`;

  const secret = require('fs').readFileSync(walletPath, 'utf-8');
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));

  const connection = new Connection(rpcUrl, 'confirmed');
  const mx = Metaplex.make(connection).use(keypairIdentity(kp));

  const items = [
    { name: 'Karambit', symbol: 'SKIN', uri: 'https://arweave.net/karambit.json' },
    { name: 'AWP Dragon Lore', symbol: 'SKIN', uri: 'https://arweave.net/awp.json' },
    { name: 'Glock Fade', symbol: 'SKIN', uri: 'https://arweave.net/glock.json' },
  ];

  const minted: { name: string; mint: PublicKey }[] = [];

  for (const it of items) {
    const { nft } = await mx.nfts().create({
      name: it.name,
      symbol: it.symbol,
      uri: it.uri,
      sellerFeeBasisPoints: 0,
      isMutable: true,
    });
    minted.push({ name: it.name, mint: nft.address });
  }

  console.log(JSON.stringify(minted.map(m => ({ name: m.name, mint: m.mint.toBase58() })), null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
