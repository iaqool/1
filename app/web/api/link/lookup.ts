import type { VercelRequest, VercelResponse } from '@vercel/node'
import { links } from './verify'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const steamId = (req.query.steamId || req.body?.steamId) as string
  if (!steamId) return res.status(400).json({ ok: false, err: 'steamId required' })
  return res.status(200).json({ pubkey: links.get(steamId) || null })
}
