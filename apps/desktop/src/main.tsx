// apps/desktop/src/main.tsx
// ─────────────────────────────────────────────────────────────
// Desktop entry point. Intentionally near-identical to
// apps/web/src/main.tsx — the whole point of the architecture is
// that this file does NOT need platform-specific logic. Tauri's
// `window.__TAURI_INTERNALS__` is injected by the WebView itself
// before this script runs, so @pazariopos/core's `platform` singleton
// already resolves to 'desktop' by the time PosScreen mounts.
// ─────────────────────────────────────────────────────────────

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { PosScreen } from '@pazariopos/ui'
import '@pazariopos/ui/styles.css'
import { setApiBaseUrl } from '@pazariopos/core'

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
