// apps/web/src/main.tsx
// ─────────────────────────────────────────────────────────────
// Web entry point. Mounts the exact same <PosScreen /> that the
// desktop app mounts — all platform branching happens inside
// @pazariopos/core's service factories, not here.
// ─────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { PosScreen } from '@pazariopos/ui'
import '@pazariopos/ui/styles.css'
import { setApiBaseUrl } from '@pazariopos/core'

// Web builds default to same-origin (relative /api/... requests)
// unless VITE_API_BASE_URL is explicitly set — this is what lets a
// single nginx-fronted domain (this build's static files + a /api
// proxy to the Fastify server) work with zero CORS complexity.
// Unlike apps/desktop/src/main.tsx (Tauri's webview isn't served from
// an http(s) origin, so it genuinely needs an absolute URL and keeps
// @pazariopos/core's 'http://localhost:3000' default), this ALWAYS
// calls setApiBaseUrl — even with an empty string — rather than
// skipping the call when the env var is unset, which would otherwise
// silently fall through to that same desktop-oriented default and
// break any production deployment that isn't served from localhost:3000.
setApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '')

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element (#root) not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <PosScreen />
  </StrictMode>,
)
