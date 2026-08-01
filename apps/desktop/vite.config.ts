// apps/desktop/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Fixed port required: tauri.conf.json's `build.devUrl` points at
// http://localhost:1420 and must match exactly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Don't trigger a Vite reload when Rust recompiles.
      ignored: ['**/src-tauri/**'],
    },
    proxy: {
      // Same reasoning as apps/web/vite.config.ts — keeps a relative
      // fetch('/api/health') pointed at the real Fastify server instead
      // of Vite's dev-server SPA fallback.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Tauri uses Chromium on Windows/Linux and WebKit on macOS —
    // target a reasonably modern baseline for both.
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
