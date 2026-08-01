// packages/core/src/services/printerServiceFactory.ts
// ─────────────────────────────────────────────────────────────
// Factory / dependency-injection entry point for IPrinterService.
// This is the ONLY file UI code should import to obtain a printer
// service instance — never import Browser/TauriPrinterService directly.
// ─────────────────────────────────────────────────────────────

import { platform }               from '../platform/PlatformDetectionService'
import type { IPrinterService }   from './interfaces/IPrinterService'
import { BrowserPrinterService }  from './web/BrowserPrinterService'
import { TauriPrinterService }    from './desktop/TauriPrinterService'

let cachedInstance: IPrinterService | null = null

/**
 * Returns a singleton IPrinterService implementation appropriate for
 * the current runtime (desktop → Tauri/Rust, web → browser print).
 */
export function getPrinterService(): IPrinterService {
  if (cachedInstance) return cachedInstance

  cachedInstance = platform.isDesktop()
    ? new TauriPrinterService()
    : new BrowserPrinterService()

  return cachedInstance
}

/** Test-only helper: forces a fresh instance on next getPrinterService() call. */
export function __resetPrinterServiceForTests(): void {
  cachedInstance = null
}
