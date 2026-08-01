// apps/web/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Without this, a relative fetch('/api/health') (NetworkMonitor's
      // default healthCheckUrl) hits Vite's dev server itself, which
      // serves index.html as an SPA fallback with a 200 status — making
      // NetworkMonitor report "online" even when the Fastify server is
      // down. Proxying /api/* to the real server closes that gap.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
