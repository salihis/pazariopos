// packages/core/src/services/BarcodeService.ts
// ─────────────────────────────────────────────────────────────
// Single class implementing IBarcodeService for BOTH platforms.
// Unlike the printer service (which needed two separate classes
// because the underlying I/O mechanisms are wildly different),
// barcode capture collapses into one class here: the only branch
// point is *how* raw scan data arrives (Tauri event vs keydown),
// after which both paths share the same debounce/parse logic.
// ─────────────────────────────────────────────────────────────

import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'

import { platform } from '../platform/PlatformDetectionService'
import type {
  IBarcodeService,
  BarcodeEvent,
  BarcodeHandler,
  BarcodeFormat,
  UnsubscribeFn,
} from './interfaces/IBarcodeService'

// ── Config ───────────────────────────────────────────────────

/** Max gap (ms) between keystrokes to still be considered the same scan. */
const KEY_TIMEOUT_MS = 100
/** Minimum characters before we treat a buffered string as a real barcode
 *  rather than incidental fast typing. */
const MIN_BARCODE_LENGTH = 4

const TAURI_BARCODE_EVENT = 'barcode-scanned'

// ── Implementation ───────────────────────────────────────────

export class BarcodeService implements IBarcodeService {
  private handlers = new Set<BarcodeHandler>()
  private paused = false

  // Web (HID keyboard-wedge) state
  private keyBuffer = ''
  private keyTimer: ReturnType<typeof setTimeout> | null = null
  private keydownListener: ((e: KeyboardEvent) => void) | null = null

  // Desktop (Tauri event) state
  private tauriUnlisten: UnlistenFn | null = null

  constructor() {
    if (platform.isDesktop()) {
      this.#initDesktopListener()
    } else {
      this.#initWebListener()
    }
  }

  // ── IBarcodeService ───────────────────────────────────────

  onScan(handler: BarcodeHandler): UnsubscribeFn {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
  }

  dispose(): void {
    this.handlers.clear()

    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener)
      this.keydownListener = null
    }
    if (this.keyTimer) {
      clearTimeout(this.keyTimer)
      this.keyTimer = null
    }
    if (this.tauriUnlisten) {
      this.tauriUnlisten()
      this.tauriUnlisten = null
    }
  }

  // ── Desktop: Tauri event bridge ───────────────────────────

  #initDesktopListener(): void {
    listen<{ value: string; format: string; scanned_at: string; source: string }>(
      TAURI_BARCODE_EVENT,
      event => {
        if (this.paused) return

        this.#dispatch({
          value: event.payload.value,
          format: this.#normalizeFormat(event.payload.format),
          scannedAt: event.payload.scanned_at,
          source: event.payload.source === 'serial' ? 'serial' : 'hid',
        })
      },
    ).then(unlisten => {
      this.tauriUnlisten = unlisten
    })
  }

  // ── Web: keyboard-wedge (HID-as-keyboard) listener ────────
  //
  // USB barcode scanners in HID mode inject keystrokes exactly like a
  // very fast typist, terminated by Enter. We buffer characters and
  // flush on Enter OR after KEY_TIMEOUT_MS of silence — the latter
  // guards against a scan that isn't Enter-terminated (some scanner
  // configs use Tab instead).

  #initWebListener(): void {
    this.keydownListener = (e: KeyboardEvent) => {
      if (this.paused) return

      // Ignore modifier-only presses so they don't pollute the buffer.
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return
      }

      if (e.key === 'Enter') {
        this.#flushKeyBuffer('keyboard')
        return
      }

      // Printable, single-character keys only (barcode payloads are
      // alphanumeric — this also filters out stray "ArrowLeft" etc.)
      //
      // The `typeof e.key === 'string'` guard isn't redundant: some
      // browser extensions dispatch synthetic KeyboardEvents with `key`
      // left undefined (seen with shopping/autofill extensions injecting
      // their own listeners), which would otherwise throw on every
      // keystroke since this listener is global on `document` — including
      // while typing in the login form, completely unrelated to scanning.
      if (typeof e.key === 'string' && e.key.length === 1) {
        this.keyBuffer += e.key
      }

      if (this.keyTimer) clearTimeout(this.keyTimer)
      this.keyTimer = setTimeout(() => this.#flushKeyBuffer('keyboard'), KEY_TIMEOUT_MS)
    }

    document.addEventListener('keydown', this.keydownListener)
  }

  #flushKeyBuffer(source: BarcodeEvent['source']): void {
    const value = this.keyBuffer
    this.keyBuffer = ''

    if (this.keyTimer) {
      clearTimeout(this.keyTimer)
      this.keyTimer = null
    }

    if (value.length < MIN_BARCODE_LENGTH) return

    this.#dispatch({
      value,
      format: this.#guessFormat(value),
      scannedAt: new Date().toISOString(),
      source,
    })
  }

  // ── Shared ─────────────────────────────────────────────────

  #dispatch(event: BarcodeEvent): void {
    for (const handler of this.handlers) handler(event)
  }

  #normalizeFormat(raw: string): BarcodeFormat {
    const known: BarcodeFormat[] = [
      'EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'QR_CODE', 'UPC_A', 'UPC_E',
    ]
    return (known as string[]).includes(raw) ? (raw as BarcodeFormat) : 'UNKNOWN'
  }

  #guessFormat(value: string): BarcodeFormat {
    if (/^\d{13}$/.test(value)) return 'EAN_13'
    if (/^\d{8}$/.test(value)) return 'EAN_8'
    if (/^\d{12}$/.test(value)) return 'UPC_A'
    return 'UNKNOWN'
  }
}
