// packages/core/src/services/barcodeServiceFactory.ts
// ─────────────────────────────────────────────────────────────
// Single entry point for obtaining the barcode service.
// UI code should always import from here, never construct
// BarcodeService directly (keeps a single set of listeners alive).
// ─────────────────────────────────────────────────────────────

import { BarcodeService } from './BarcodeService'
import type { IBarcodeService } from './interfaces/IBarcodeService'

let cachedInstance: IBarcodeService | null = null

export function getBarcodeService(): IBarcodeService {
  if (!cachedInstance) {
    cachedInstance = new BarcodeService()
  }
  return cachedInstance
}

/** Test-only helper: disposes and clears the cached singleton. */
export function __resetBarcodeServiceForTests(): void {
  cachedInstance?.dispose()
  cachedInstance = null
}
