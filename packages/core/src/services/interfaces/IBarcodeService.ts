// packages/core/src/services/interfaces/IBarcodeService.ts
// ─────────────────────────────────────────────────────────────
// Contract for barcode scanning across platforms.
// ─────────────────────────────────────────────────────────────

export type BarcodeFormat =
  | 'EAN_13' | 'EAN_8'
  | 'CODE_128' | 'CODE_39'
  | 'QR_CODE'
  | 'UPC_A' | 'UPC_E'
  | 'UNKNOWN'

export interface BarcodeEvent {
  value: string
  format: BarcodeFormat
  scannedAt: string    // ISO-8601
  source: 'hid' | 'serial' | 'camera' | 'keyboard'
}

export type BarcodeHandler = (event: BarcodeEvent) => void
export type UnsubscribeFn  = () => void

export interface IBarcodeService {
  /**
   * Register a handler that fires every time a barcode is scanned.
   * Returns an unsubscribe function — call it in component cleanup.
   */
  onScan(handler: BarcodeHandler): UnsubscribeFn

  /**
   * Temporarily suspend scanning (e.g., while a modal is open).
   */
  pause(): void

  /**
   * Resume scanning after a pause().
   */
  resume(): void

  /**
   * Release all resources (event listeners, serial port handles, etc.).
   * Call on app shutdown or hot-module replacement.
   */
  dispose(): void
}
