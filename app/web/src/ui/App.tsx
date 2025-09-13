import React, { useMemo, useState, useEffect } from 'react'
import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import idl from '../idl/skinsol.json'
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token'
import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
} from '@metaplex-foundation/mpl-token-metadata'

const PROGRAM_ID = (import.meta as any).env.VITE_PROGRAM_ID || (idl as any).address

export default function App() {
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const [status, setStatus] = useState<string>('')
  const [vaultPda, setVaultPda] = useState<string>('')
  const [totalDeposits, setTotalDeposits] = useState<string>('0')
  // Rental UI state
  const [mintStr, setMintStr] = useState<string>('')
  const [dailyPrice, setDailyPrice] = useState<string>('100')
  const [rentDays, setRentDays] = useState<string>('3')
  const [listingInfo, setListingInfo] = useState<any>(null)
  // Mint NFT UI state
  const [mintName, setMintName] = useState<string>('Skin NFT')
  const [mintSymbol, setMintSymbol] = useState<string>('SKIN')
  const [mintUri, setMintUri] = useState<string>('https://arweave.net/example.json')
  const [mintedAddress, setMintedAddress] = useState<string>('')

  const [error, setError] = useState<string>('')
  // Steam link state
  const [steamId, setSteamId] = useState<string>('')
  const [linkServerUrl, setLinkServerUrl] = useState<string>(() => {
    const envUrl = (import.meta as any).env.VITE_LINK_SERVER_URL
    if (envUrl) return envUrl
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
    return 'http://localhost:3000'
  })
  const [linkedPubkey, setLinkedPubkey] = useState<string>('')
  // Credit after mint (devnet)
  const [autoCredit, setAutoCredit] = useState<boolean>(false)
  const [creditAmount, setCreditAmount] = useState<string>('0.5')
  const [creditSig, setCreditSig] = useState<string>('')
  const [autoDeposit, setAutoDeposit] = useState<boolean>(false)

  const provider = useMemo(() => {
    try {
      if (!wallet) return null
      return new AnchorProvider(connection, wallet as any, { preflightCommitment: 'confirmed' })
    } catch (e: any) {
      setError(`Provider error: ${e?.message || String(e)}`)
      return null
    }
  }, [wallet, connection])

  const program = useMemo(() => {
    try {
      if (!provider) return null
      const resolvedIdl = PROGRAM_ID ? { ...(idl as any), address: PROGRAM_ID } : (idl as any)
      // Используем overload new Program(idl, provider), где адрес берётся из idl.address
      return new Program(resolvedIdl as any, provider) as any
    } catch (e: any) {
      setError(`Program init error: ${e?.message || String(e)}`)
      return null
    }
  }, [provider])

  // Parse steamId from URL once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('steamId') || ''
    if (sid) setSteamId(sid)
  }, [])

  const derivePda = (authority: web3.PublicKey) => {
    return web3.PublicKey.findProgramAddressSync([
      Buffer.from('vault'), authority.toBuffer()
    ], new web3.PublicKey(PROGRAM_ID))[0]
  }

  const listingPdaForMint = (mint: web3.PublicKey) => {
    return web3.PublicKey.findProgramAddressSync([
      Buffer.from('listing'), mint.toBuffer()
    ], new web3.PublicKey(PROGRAM_ID))[0]
  }

  const ensureInit = async () => {
    if (!program || !wallet) return
    const pda = derivePda(wallet.publicKey)
    try {
      const info = await connection.getAccountInfo(pda)
      if (!info) {
        setStatus('Инициализируем хранилище...')
        await program.methods?.initializeVault().accounts({
          authority: wallet.publicKey,
          vault: pda,
          systemProgram: web3.SystemProgram.programId,
        } as any).rpc()
      }
      setVaultPda(pda.toBase58())
      setStatus('Готово')
    } catch (e: any) {
      setError(`Init error: ${e?.message || String(e)}`)
      setStatus('Ошибка')
    }
  }

  const doDeposit = async (amount: number) => {
    if (!program || !wallet) return
    const pda = derivePda(wallet.publicKey)
    try {
      setStatus('Депозит...')
      await program.methods?.deposit(new anchor.BN(amount)).accounts({
        user: wallet.publicKey,
        vault: pda,
      } as any).rpc()
      const v = await program.account?.vault?.fetch(pda)
      setTotalDeposits(v.totalDeposits.toString())
      setStatus('Депозит выполнен')
    } catch (e: any) {
      setError(`Deposit error: ${e?.message || String(e)}`)
      setStatus('Ошибка')
    }
  }

  const fetchVault = async () => {
    if (!program || !wallet) return
    const pda = derivePda(wallet.publicKey)
    try {
      setStatus('Загрузка...')
  const v = await program.account?.vault?.fetch(pda)
      setTotalDeposits(v.totalDeposits.toString())
      setVaultPda(pda.toBase58())
      setStatus('Готово')
    } catch (e: any) {
      setError(`Fetch error: ${e?.message || String(e)}`)
      setStatus('Ошибка')
    }
  }

  // --- Rental flows ---
  const listForRent = async () => {
    if (!program || !wallet) return
    try {
      const mint = new web3.PublicKey(mintStr)
      const listingPda = listingPdaForMint(mint)
      setStatus('List for rent...')
      await program.methods
        .listForRent(new anchor.BN(Number(dailyPrice)))
        .accounts({ owner: wallet.publicKey, mint, listing: listingPda, systemProgram: web3.SystemProgram.programId } as any)
        .rpc()
      const info = await (program.account as any).listing.fetch(listingPda)
      setListingInfo({ ...info, pda: listingPda.toBase58() })
      setStatus('NFT listed')
    } catch (e: any) {
      // fallback: simulate in localStorage
      const sim = { owner: wallet?.publicKey?.toBase58(), mint: mintStr, dailyPriceUsd: Number(dailyPrice), isListed: true, renter: '', rentedUntil: 0 }
      localStorage.setItem(`listing:${mintStr}`, JSON.stringify(sim))
      setListingInfo(sim)
      setError(`List (simulated): ${e?.message || String(e)}`)
      setStatus('Simulated listing')
    }
  }

  const rentNft = async () => {
    if (!program || !wallet) return
    try {
      const mint = new web3.PublicKey(mintStr)
      const listingPda = listingPdaForMint(mint)
      setStatus('Renting...')
      await program.methods
        .rent(new anchor.BN(Number(rentDays)))
        .accounts({ renter: wallet.publicKey, mint, listing: listingPda } as any)
        .rpc()
      const info = await (program.account as any).listing.fetch(listingPda)
      setListingInfo({ ...info, pda: listingPda.toBase58() })
      setStatus('NFT rented')
    } catch (e: any) {
      // fallback simulate
      const prev = localStorage.getItem(`listing:${mintStr}`)
      const now = Date.now()
      const rentedUntil = now + Number(rentDays) * 86400 * 1000
      let sim: any = prev ? JSON.parse(prev) : { mint: mintStr, dailyPriceUsd: Number(dailyPrice) }
      sim.isListed = false
      sim.renter = wallet?.publicKey?.toBase58()
      sim.rentedUntil = Math.floor(rentedUntil / 1000)
      localStorage.setItem(`listing:${mintStr}`, JSON.stringify(sim))
      setListingInfo(sim)
      setError(`Rent (simulated): ${e?.message || String(e)}`)
      setStatus('Simulated rent')
    }
  }

  const fetchListing = async () => {
    if (!program || !wallet) return
    try {
      const mint = new web3.PublicKey(mintStr)
      const listingPda = listingPdaForMint(mint)
      setStatus('Fetch listing...')
      const info = await (program.account as any).listing.fetch(listingPda)
      setListingInfo({ ...info, pda: listingPda.toBase58() })
      setStatus('Готово')
    } catch (e: any) {
      const prev = localStorage.getItem(`listing:${mintStr}`)
      setListingInfo(prev ? JSON.parse(prev) : null)
      setError(`Fetch listing (simulated): ${e?.message || String(e)}`)
      setStatus('Simulated fetch')
    }
  }

  const liquidate = async () => {
    if (!program || !wallet) return
    try {
      const pda = derivePda(wallet.publicKey)
      setStatus('Liquidate...')
      await program.methods
        .liquidate()
        .accounts({ authority: wallet.publicKey, vault: pda } as any)
        .rpc()
      const v = await program.account?.vault?.fetch(pda)
      setTotalDeposits(v.totalDeposits.toString())
      setStatus('Ликвидировано')
    } catch (e: any) {
      setError(`Liquidate error: ${e?.message || String(e)}`)
      setStatus('Ошибка')
    }
  }

  const mintNft = async () => {
    if (!provider || !wallet) return
    try {
      setError('')
      setStatus('Minting NFT...')

      const payer = wallet.publicKey!
      const mint = web3.Keypair.generate()

      // 1) Создаём аккаунт mint и инициализируем его как NFT (decimals = 0)
      const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE)
      const tx1 = new web3.Transaction()
      tx1.add(
        web3.SystemProgram.createAccount({
          fromPubkey: payer,
          newAccountPubkey: mint.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(mint.publicKey, 0, payer, payer, TOKEN_PROGRAM_ID),
      )

      // 2) Создаём ATA для минтера и минтим 1 токен
      const ata = getAssociatedTokenAddressSync(mint.publicKey, payer)
      tx1.add(
        createAssociatedTokenAccountInstruction(payer, ata, payer, mint.publicKey),
        createMintToInstruction(mint.publicKey, ata, payer, 1),
      )

      tx1.feePayer = payer
      tx1.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx1.partialSign(mint)
      const signed = await wallet.signTransaction!(tx1)
      const sig1 = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
      await connection.confirmTransaction(sig1, 'confirmed')

      // 3) Создаём Metadata и MasterEdition для NFT
      const [metadataPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer()],
        TOKEN_METADATA_PROGRAM_ID,
      )
      const [masterEditionPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.publicKey.toBuffer(), Buffer.from('edition')],
        TOKEN_METADATA_PROGRAM_ID,
      )

      const tx2 = new web3.Transaction()
      tx2.add(
        createCreateMetadataAccountV3Instruction(
          {
            metadata: metadataPda,
            mint: mint.publicKey,
            mintAuthority: payer,
            payer,
            updateAuthority: payer,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: mintName,
                symbol: mintSymbol,
                uri: mintUri,
                sellerFeeBasisPoints: 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          },
        ),
        createCreateMasterEditionV3Instruction(
          {
            edition: masterEditionPda,
            mint: mint.publicKey,
            updateAuthority: payer,
            mintAuthority: payer,
            payer,
            metadata: metadataPda,
          },
          {
            createMasterEditionArgs: { maxSupply: 0 },
          },
        ),
      )
      tx2.feePayer = payer
      tx2.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      const signed2 = await wallet.signTransaction!(tx2)
      const sig2 = await connection.sendRawTransaction(signed2.serialize(), { skipPreflight: false })
      await connection.confirmTransaction(sig2, 'confirmed')

      const mintedAddr = mint.publicKey.toBase58()
      setMintedAddress(mintedAddr)
      setMintStr(mintedAddr)
      setStatus('NFT minted')

      // Optional auto-deposit as collateral (only if Vault not exists)
      if (autoDeposit && program) {
        try {
          const vPda = derivePda(payer)
          const info = await connection.getAccountInfo(vPda)
          if (!info) {
            // derive simple u64 from mint address (stable 32-bit hash)
            const h = (() => { let x = 5381 >>> 0; for (const ch of mintedAddr) x = (((x << 5) + x) + ch.charCodeAt(0)) >>> 0; return x; })()
            // @ts-ignore BN from anchor
            const skinIdBn = new (anchor as any).BN(h)
            setStatus('Depositing collateral (init vault)...')
            await program.methods
              .depositSkinAsCollateral(skinIdBn)
              .accounts({ user: payer, vault: vPda, systemProgram: web3.SystemProgram.programId } as any)
              .rpc()
            setVaultPda(vPda.toBase58())
            setStatus('Collateral deposited ✓')
          } else {
            // Vault already exists; skip to avoid init conflict
            setStatus('Vault exists, skipping auto-deposit')
          }
        } catch (e: any) {
          setError(`Auto-deposit: ${e?.message || String(e)}`)
          setStatus('Ошибка')
        }
      }

      // Optional credit grant after mint
      if (autoCredit) {
        try {
          setStatus('Requesting credit...')
          const resp = await fetch(`${linkServerUrl}/credit/transfer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: payer.toBase58(), sol: Number(creditAmount) })
          })
          const jr = await resp.json()
          if (!jr.ok) throw new Error(jr.err || 'credit failed')
          setCreditSig(jr.signature)
          setStatus('Credit received ✓')
        } catch (e: any) {
          setError(`Credit: ${e?.message || String(e)}`)
          setStatus('Ошибка')
        }
      }
    } catch (e: any) {
      setError(e?.message || String(e))
      setStatus('Ошибка')
    }
  }

  // --- Steam Link flows ---
  const openSteamLogin = () => {
    window.location.href = `${linkServerUrl}/auth/steam`
  }

  const linkWallet = async () => {
    try {
      setError('')
      setStatus('Linking wallet to Steam...')
      if (!wallet?.publicKey) throw new Error('Connect wallet first')
      if (!steamId) throw new Error('No steamId. Click Login with Steam')

      const nonceResp = await fetch(`${linkServerUrl}/link/nonce?steamId=${steamId}`)
      const { nonce } = await nonceResp.json()
      if (!nonce) throw new Error('No nonce from server')

      // signMessage in Wallet Adapter
      // @ts-ignore
      if (!wallet.signMessage) throw new Error('Wallet does not support signMessage')
      const encoded = new TextEncoder().encode(nonce)
      // @ts-ignore
      const signature = await wallet.signMessage(encoded)
      const sigB64 = Buffer.from(signature).toString('base64')

      const body = {
        steamId,
        pubkey: wallet.publicKey.toBase58(),
        signature: sigB64,
        nonce,
      }
      const verifyResp = await fetch(`${linkServerUrl}/link/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      const vr = await verifyResp.json()
      if (!vr.ok) throw new Error(vr.err || 'verify failed')
      setLinkedPubkey(wallet.publicKey.toBase58())
      setStatus('Linked ✓')
    } catch (e: any) {
      setError(e?.message || String(e))
      setStatus('Ошибка')
    }
  }

  const lookupLink = async () => {
    try {
      setError('')
      setStatus('Lookup link...')
      if (!steamId) throw new Error('No steamId')
      const r = await fetch(`${linkServerUrl}/link/lookup?steamId=${steamId}`)
      const j = await r.json()
      setLinkedPubkey(j?.pubkey || '')
      setStatus('Готово')
    } catch (e: any) {
      setError(e?.message || String(e))
      setStatus('Ошибка')
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>SkinSol Demo (Devnet)</h1>
      <WalletMultiButton />

      {!wallet && <p>Подключите кошелёк для начала.</p>}

      {wallet && (
        <>
          <hr style={{ margin: '24px 0' }} />
          <h3>Steam Link</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Link server URL" value={linkServerUrl} onChange={e => setLinkServerUrl(e.target.value)} style={{ minWidth: 360 }} />
            <input placeholder="steamId" value={steamId} onChange={e => setSteamId(e.target.value)} style={{ minWidth: 260 }} />
            <button onClick={openSteamLogin}>Login with Steam</button>
            <button onClick={linkWallet}>Link Wallet</button>
            <button onClick={lookupLink}>Lookup</button>
          </div>
          <div style={{ marginTop: 8 }}>Linked pubkey: {linkedPubkey || '—'}</div>

          <div style={{ marginTop: 16 }}>
            <button onClick={ensureInit}>Init Vault (idempotent)</button>
            <button onClick={() => doDeposit(100)} style={{ marginLeft: 8 }}>Deposit 100</button>
            <button onClick={fetchVault} style={{ marginLeft: 8 }}>Fetch Vault</button>
            <button onClick={liquidate} style={{ marginLeft: 8 }}>Liquidate (manual)</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div>Status: {status}</div>
            {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
            <div>Vault PDA: {vaultPda || '—'}</div>
            <div>Total deposits: {totalDeposits}</div>
          </div>

          <hr style={{ margin: '24px 0' }} />
          <h3>Mint NFT</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Name" value={mintName} onChange={e => setMintName(e.target.value)} />
            <input placeholder="Symbol" value={mintSymbol} onChange={e => setMintSymbol(e.target.value)} style={{ width: 120 }} />
            <input placeholder="Metadata URI (https://...)" value={mintUri} onChange={e => setMintUri(e.target.value)} style={{ minWidth: 360 }} />
            <button onClick={mintNft}>Mint</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label><input type="checkbox" checked={autoCredit} onChange={e => setAutoCredit(e.target.checked)} /> Auto-credit after mint</label>
            <input placeholder="Amount (DEV SOL)" type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} style={{ width: 140 }} />
            {creditSig && <span>Tx: <a href={`https://explorer.solana.com/tx/${creditSig}?cluster=devnet`} target="_blank" rel="noreferrer">{creditSig.slice(0,12)}…</a></span>}
          </div>
          <div style={{ marginTop: 8 }}>
            <label><input type="checkbox" checked={autoDeposit} onChange={e => setAutoDeposit(e.target.checked)} /> Auto-deposit minted NFT as collateral (only if vault not exists)</label>
          </div>
          {mintedAddress && (
            <div style={{ marginTop: 8 }}>Minted: <code>{mintedAddress}</code></div>
          )}

          <hr style={{ margin: '24px 0' }} />
          <h3>Rental</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Mint address" value={mintStr} onChange={e => setMintStr(e.target.value)} style={{ minWidth: 360 }} />
            <input placeholder="Daily price (USD)" type="number" value={dailyPrice} onChange={e => setDailyPrice(e.target.value)} />
            <button onClick={listForRent}>List for rent</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Days" type="number" value={rentDays} onChange={e => setRentDays(e.target.value)} />
            <button onClick={rentNft}>Rent</button>
            <button onClick={fetchListing}>Fetch listing</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <div><strong>Listing:</strong></div>
            <pre style={{ background: '#111', color: '#eee', padding: 12, borderRadius: 8, overflowX: 'auto' }}>{listingInfo ? JSON.stringify(listingInfo, null, 2) : '—'}</pre>
          </div>
        </>
      )}

      <hr style={{ margin: '24px 0' }} />
      <div>
        <strong>Config</strong>
        <div>RPC: {connection.rpcEndpoint}</div>
        <div>Program ID: {PROGRAM_ID}</div>
      </div>
    </div>
  )
}
