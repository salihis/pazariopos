// packages/core/src/services/web/BrowserPrinterService.ts
// ─────────────────────────────────────────────────────────────
// Web printer implementation.
// Opens a hidden popup window containing a print-ready HTML receipt
// and triggers window.print() automatically.
// Cash drawer: NOT supported — logs a warning and continues.
// ─────────────────────────────────────────────────────────────

import type { IPrinterService, PrinterConfig, PrintResult } from '../interfaces/IPrinterService'
import { DEFAULT_PRINTER_CONFIG }                           from '../interfaces/IPrinterService'
import type { Sale, ReportData }                            from '../../types/domain'
import { buildReceiptHTML, buildReportHTML }                from './receiptTemplate'

export class BrowserPrinterService implements IPrinterService {

  // ── IPrinterService ─────────────────────────────────────────

  async printReceipt(
    sale: Sale,
    config: Partial<PrinterConfig> = {},
  ): Promise<PrintResult> {
    const cfg = { ...DEFAULT_PRINTER_CONFIG, ...config }

    if (cfg.openCashDrawer) {
      console.warn('[BrowserPrinterService] Cash drawer pulse not supported in browser mode.')
    }

    return this.#openAndPrint(buildReceiptHTML(sale))
  }

  async printReport(
    data: ReportData,
    config: Partial<PrinterConfig> = {},
  ): Promise<PrintResult> {
    void config  // paper width / copies not applicable in browser mode
    return this.#openAndPrint(buildReportHTML(data.title, data.rows))
  }

  async testPrint(_config?: Partial<PrinterConfig>): Promise<boolean> {
    const html = buildReportHTML('TEST PRINT', [
      { Status: 'OK', Timestamp: new Date().toISOString(), Platform: 'Browser' },
    ])
    const result = await this.#openAndPrint(html)
    return result.success
  }

  async listPrinters(): Promise<string[]> {
    // The browser Print API does not expose the printer list to JavaScript.
    return ['Browser Default (system dialog)']
  }

  // ── Private ─────────────────────────────────────────────────

  /**
   * Opens a new browser window, writes HTML into it, and waits for the
   * print dialog to be triggered by the page's own onload script.
   *
   * We resolve the promise once the window is opened (not once printing
   * finishes — the browser does not expose that event).
   */
  #openAndPrint(html: string): Promise<PrintResult> {
    return new Promise(resolve => {
      const win = window.open('', '_blank', 'width=400,height=600,scrollbars=no')

      if (!win) {
        resolve({
          success: false,
          errorMessage:
            'Popup blocked. Allow popups for this site and try again.',
        })
        return
      }

      win.document.open()
      win.document.write(html)
      win.document.close()

      // The HTML page's own <script> calls window.print() on load.
      // We optimistically resolve here; if the user cancels the dialog
      // we have no way to detect that from the parent window.
      resolve({ success: true, printerUsed: 'Browser Default' })
    })
  }
}
