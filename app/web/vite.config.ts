import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Полезные алиасы для браузерных полифиллов Node.js модулей
const alias = {
  crypto: 'crypto-browserify',
  stream: 'stream-browserify',
  events: 'events',
  path: 'path-browserify',
  util: 'util',
  buffer: 'buffer',
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  base: '',
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: { alias },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
  },
})
