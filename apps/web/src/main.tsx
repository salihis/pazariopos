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

// Vite exposes env vars prefixed VITE_ via import.meta.env — this file
// (not packages/core) is the correct place for that coupling, since
// apps/web already depends on Vite.
if (import.meta.env.VITE_API_BASE_URL) {
  setApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element (#root) not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <PosScreen />
  </StrictMode>,
)
