import type { VercelRequest, VercelResponse } from '@vercel/node'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { nonces } from './nonce'

const links = new Map<string, string>()

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { steamId, pubkey, signature, nonce } = req.body || {}
    if (!steamId || !pubkey || !signature || !nonce) return res.status(400).json({ ok: false, err: 'missing fields' })
    const stored = nonces.get(steamId)
    if (!stored || stored !== nonce) return res.status(400).json({ ok: false, err: 'nonce mismatch' })

    const pub = bs58.decode(pubkey)
    let sig: Uint8Array
    try { sig = new Uint8Array(Buffer.from(signature, 'base64')) } catch { sig = bs58.decode(signature) }
    const msg = new TextEncoder().encode(nonce)
    const ok = nacl.sign.detached.verify(msg, sig, pub)
    if (!ok) return res.status(400).json({ ok: false, err: 'invalid signature' })

    links.set(steamId, pubkey)
    nonces.delete(steamId)
    return res.status(200).json({ ok: true })
  } catch (e: any) {
    return res.status(500).json({ ok: false, err: e?.message || String(e) })
  }
}

export { links }
