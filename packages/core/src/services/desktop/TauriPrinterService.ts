// packages/core/src/services/desktop/TauriPrinterService.ts
// ─────────────────────────────────────────────────────────────
// Desktop printer implementation.
// Delegates the actual byte-level ESC/POS work to Rust via Tauri's
// `invoke` IPC bridge. This file stays "dumb" on purpose — all
// hardware logic lives in apps/desktop/src-tauri/src/commands/printer.rs
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core'

import type { IPrinterService, PrinterConfig, PrintResult } from '../interfaces/IPrinterService'
import { DEFAULT_PRINTER_CONFIG }                           from '../interfaces/IPrinterService'
import type { Sale, ReportData }                            from '../../types/domain'

// ── Rust <-> TS payload shapes ──────────────────────────────
// Mirrors the #[derive(Deserialize)] structs on the Rust side.
// Keeping these explicit (rather than reusing `Sale` directly)
// insulates the Rust command signature from frontend refactors.

interface PrintReceiptArgs {
  sale: Sale
  printerName: string | null
  paperWidth: number
  copies: number
  openCashDrawer: boolean
}

interface PrintReportArgs {
  title: string
  generatedAt: string
  rows: Record<string, unknown>[]
  printerName: string | null
  paperWidth: number
}

interface RustPrintResult {
  success: boolean
  error_message?: string
  printer_used?: string
}

export class TauriPrinterService implements IPrinterService {

  async printReceipt(
    sale: Sale,
    config: Partial<PrinterConfig> = {},
  ): Promise<PrintResult> {
    const cfg = { ...DEFAULT_PRINTER_CONFIG, ...config }

    try {
      const result = await invoke<RustPrintResult>('print_receipt', {
        sale,
        printerName: cfg.printerName ?? null,
        paperWidth: cfg.paperWidth,
        copies: cfg.copies,
        openCashDrawer: cfg.openCashDrawer,
      } satisfies PrintReceiptArgs)

      return this.#fromRust(result)
    } catch (err) {
      return { success: false, errorMessage: this.#stringifyError(err) }
    }
  }

  async printReport(
    data: ReportData,
    config: Partial<PrinterConfig> = {},
  ): Promise<PrintResult> {
    const cfg = { ...DEFAULT_PRINTER_CONFIG, ...config }

    try {
      const result = await invoke<RustPrintResult>('print_report', {
        title: data.title,
        generatedAt: data.generatedAt,
        rows: data.rows,
        printerName: cfg.printerName ?? null,
        paperWidth: cfg.paperWidth,
      } satisfies PrintReportArgs)

      return this.#fromRust(result)
    } catch (err) {
      return { success: false, errorMessage: this.#stringifyError(err) }
    }
  }

  async testPrint(config: Partial<PrinterConfig> = {}): Promise<boolean> {
    try {
      const result = await invoke<RustPrintResult>('test_print', {
        printerName: config.printerName ?? null,
      })
      return result.success
    } catch {
      return false
    }
  }

  async listPrinters(): Promise<string[]> {
    try {
      return await invoke<string[]>('list_printers')
    } catch (err) {
      console.error('[TauriPrinterService] Failed to list printers:', err)
      return []
    }
  }

  // ── Private ─────────────────────────────────────────────────

  #fromRust(result: RustPrintResult): PrintResult {
    return {
      success: result.success,
      errorMessage: result.error_message,
      printerUsed: result.printer_used,
    }
  }

  #stringifyError(err: unknown): string {
    if (err instanceof Error) return err.message
    if (typeof err === 'string') return err
    return 'Unknown error communicating with the printer service.'
  }
}
