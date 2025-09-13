import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  const front = process.env.FRONTEND_URL || (req.headers.origin as string) || 'https://localhost:5173'
  const mockSteamId = 'STEAM_0:MOCK:USER'
  const url = new URL(front)
  url.searchParams.set('steamId', mockSteamId)
  res.writeHead(302, { Location: url.toString() })
  res.end()
}
