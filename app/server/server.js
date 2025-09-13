import express from 'express'
import session from 'express-session'
import passport from 'passport'
import { Strategy as SteamStrategy } from 'passport-steam'
import cors from 'cors'
import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, clusterApiUrl, PublicKey } from '@solana/web3.js'

const PORT = process.env.PORT || 3000
const REALM = process.env.REALM || `http://localhost:${PORT}/`
const RETURN_URL = process.env.RETURN_URL || `http://localhost:${PORT}/auth/steam/return`

if (!process.env.STEAM_API_KEY) {
  console.warn('Warning: STEAM_API_KEY is not set. Steam login will not work.')
}

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(session({ secret: 'skinsol-hack', resave: false, saveUninitialized: true }))
app.use(express.json())
app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((obj, done) => done(null, obj))

passport.use(new SteamStrategy({
  returnURL: RETURN_URL,
  realm: REALM,
  apiKey: process.env.STEAM_API_KEY || 'demo'
}, (identifier, profile, done) => {
  process.nextTick(() => done(null, profile))
}))

app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), (_req, _res) => {})
app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
  const steamId = req.user?.id
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?steamId=${steamId}`)
})

// Demo storage
const nonces = new Map()
const links = new Map()

app.get('/link/nonce', (req, res) => {
  const steamId = req.query.steamId
  if (!steamId) return res.status(400).json({ ok: false, err: 'steamId required' })
  const nonce = Math.random().toString(36).slice(2)
  nonces.set(steamId, nonce)
  res.json({ nonce })
})

app.post('/link/verify', (req, res) => {
  try {
    const { steamId, pubkey, signature, nonce } = req.body || {}
    if (!steamId || !pubkey || !signature || !nonce) return res.status(400).json({ ok: false, err: 'missing fields' })
    const stored = nonces.get(steamId)
    if (!stored || stored !== nonce) return res.status(400).json({ ok: false, err: 'nonce mismatch' })

    // Convert base58 pubkey and base64/base58 signature to Uint8Array
    const pub = bs58.decode(pubkey)
    let sig
    try {
      sig = Buffer.from(signature, 'base64')
    } catch {
      // fallback: maybe base58
      sig = bs58.decode(signature)
    }
    const msg = new TextEncoder().encode(nonce)
    const ok = nacl.sign.detached.verify(msg, new Uint8Array(sig), pub)
    if (!ok) return res.status(400).json({ ok: false, err: 'invalid signature' })

    links.set(steamId, pubkey)
    nonces.delete(steamId)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, err: String(e) })
  }
})

app.get('/link/lookup', (req, res) => {
  const steamId = req.query.steamId
  if (!steamId) return res.status(400).json({ ok: false, err: 'steamId required' })
  res.json({ pubkey: links.get(steamId) || null })
})

// Devnet credit transfer (for demo)
app.post('/credit/transfer', async (req, res) => {
  try {
    const { to, sol } = req.body || {}
    if (!to || !sol) return res.status(400).json({ ok: false, err: 'missing fields: to, sol' })
    const endpoint = process.env.RPC_URL || clusterApiUrl('devnet')
    const conn = new Connection(endpoint, 'confirmed')
    const secret = process.env.FUND_WALLET_SECRET
    if (!secret) return res.status(400).json({ ok: false, err: 'FUND_WALLET_SECRET not set' })
    const payer = Keypair.fromSecretKey(bs58.decode(secret))

    const toPk = new PublicKey(to)
    const lamports = BigInt(Math.floor(Number(sol) * LAMPORTS_PER_SOL))
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: toPk, lamports: Number(lamports) })
    )
    tx.feePayer = payer.publicKey
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    const sig = await conn.sendTransaction(tx, [payer], { skipPreflight: false })
    await conn.confirmTransaction(sig, 'confirmed')
    res.json({ ok: true, signature: sig })
  } catch (e) {
    res.status(500).json({ ok: false, err: String(e) })
  }
})

app.listen(PORT, () => console.log(`Link server up on ${PORT}`))
