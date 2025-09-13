import React from 'react'
import { createRoot } from 'react-dom/client'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import App from './ui/App'

import '@solana/wallet-adapter-react-ui/styles.css'
import { Buffer } from 'buffer'

// Полифилл Buffer для браузера (нужен для web3/anchor)
// @ts-ignore
if (!window.Buffer) {
  // @ts-ignore
  window.Buffer = Buffer
}

// Полифилл global для библиотек, ожидающих Node.js окружение
// @ts-ignore
if (typeof (globalThis as any).global === 'undefined') {
  // @ts-ignore
  ;(globalThis as any).global = globalThis
}

const endpoint = import.meta.env.VITE_RPC_URL || 'https://api.devnet.solana.com'

const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
)
