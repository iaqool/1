import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, clusterApiUrl, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, err: 'Method not allowed' })
  try {
    const { to, sol } = req.body || {}
    if (!to || typeof sol === 'undefined') return res.status(400).json({ ok: false, err: 'Missing fields: to, sol' })

    const endpoint = process.env.RPC_URL || clusterApiUrl('devnet')
    const conn = new Connection(endpoint, 'confirmed')
    const secret = process.env.FUND_WALLET_SECRET
    if (!secret) return res.status(400).json({ ok: false, err: 'FUND_WALLET_SECRET not set' })
    const payer = Keypair.fromSecretKey(bs58.decode(secret))

    const toPk = new PublicKey(to)
    const lamports = Math.round(Number(sol) * LAMPORTS_PER_SOL)
    if (!Number.isFinite(lamports) || lamports <= 0) return res.status(400).json({ ok: false, err: 'Invalid amount' })

    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: toPk, lamports })
    )
    tx.feePayer = payer.publicKey
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    const sig = await conn.sendTransaction(tx, [payer], { skipPreflight: false })
    await conn.confirmTransaction(sig, 'confirmed')
    return res.status(200).json({ ok: true, signature: sig })
  } catch (e: any) {
    return res.status(500).json({ ok: false, err: e?.message || String(e) })
  }
}
