import type { VercelRequest, VercelResponse } from '@vercel/node'

const nonces = new Map<string, string>()

export default function handler(req: VercelRequest, res: VercelResponse) {
  const steamId = (req.query.steamId || req.body?.steamId) as string
  if (!steamId) return res.status(400).json({ ok: false, err: 'steamId required' })
  const nonce = Math.random().toString(36).slice(2)
  nonces.set(steamId, nonce)
  return res.status(200).json({ nonce })
}

export { nonces }
