// packages/core/src/services/interfaces/IPrinterService.ts
// ─────────────────────────────────────────────────────────────
// Contract every printer implementation must satisfy.
// Concrete impls: BrowserPrinterService (web), TauriPrinterService (desktop).
// ─────────────────────────────────────────────────────────────

import type { Sale, ReportData } from '../../types/domain'

// ── Printer config ───────────────────────────────────────────

export type PaperWidth = 58 | 80    // mm — common thermal roll widths

export interface PrinterConfig {
  printerName?: string               // OS printer name; undefined = default
  paperWidth: PaperWidth
  copies: number
  openCashDrawer: boolean            // pulse drawer via DK-port after print
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  paperWidth: 80,
  copies: 1,
  openCashDrawer: true,
}

// ── Print result ─────────────────────────────────────────────

export interface PrintResult {
  success: boolean
  errorMessage?: string
  printerUsed?: string
}

// ── Interface ────────────────────────────────────────────────

export interface IPrinterService {
  /**
   * Print a customer receipt for a completed sale.
   * On desktop: sends ESC/POS byte stream directly to the thermal printer.
   * On web: opens a print-ready HTML window and calls window.print().
   */
  printReceipt(sale: Sale, config?: Partial<PrinterConfig>): Promise<PrintResult>

  /**
   * Print any tabular report (sales summary, stock list, etc.).
   */
  printReport(data: ReportData, config?: Partial<PrinterConfig>): Promise<PrintResult>

  /**
   * Send a test page to verify the printer is connected and responsive.
   * Returns true if the printer responded without error.
   */
  testPrint(config?: Partial<PrinterConfig>): Promise<boolean>

  /**
   * List printers available on this device.
   * Web returns ['Browser Default']; desktop returns OS printer list.
   */
  listPrinters(): Promise<string[]>
}
