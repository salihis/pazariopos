// packages/core/src/services/InventoryService.ts
// ─────────────────────────────────────────────────────────────
// Enforces architecture rule (§7 OFFLINE MODE):
//   "Inventory: safe to serve from local cache when offline"
//
// Unlike AccountBalanceService (which throws when offline),
// InventoryService degrades gracefully: it always tries a live
// fetch first, and falls back to the last successful response when
// offline or when the request fails. A stale stock count is an
// acceptable risk for a barcode lookup — an unauthorized-credit sale
// is not, which is why account balances get the stricter treatment.
//
// No web/desktop split (unlike printer/barcode): per
// ARCHITECTURE.md's platform capability matrix, Inventory Management
// is "✅ Equal" on both platforms — there's no hardware or browser-API
// dependency here, just a REST call, so a single implementation (like
// AccountBalanceService) is the right shape, not a factory.
// ─────────────────────────────────────────────────────────────

import type { Product } from '../types/domain'
import { productsApi } from '../api/salesApi'
import { getNetworkMonitor } from './NetworkMonitor'

class InventoryServiceImpl {
  #cache: Product[] = []
  #lastFetchedAt: string | null = null

  /**
   * Returns the product catalog. Tries a live fetch when online;
   * falls back to the last cached copy on failure or while offline.
   * Throws only if there is no cache AND the live fetch also fails
   * (e.g. very first launch with no connectivity yet).
   */
  async listProducts(): Promise<Product[]> {
    const monitor = getNetworkMonitor()

    if (monitor.isOnline()) {
      try {
        const products = await productsApi.listProducts()
        this.#cache = products
        this.#lastFetchedAt = new Date().toISOString()
        return products
      } catch (err) {
        if (this.#cache.length > 0) {
          console.warn('[InventoryService] Live fetch failed, serving cached catalog:', err)
          return this.#cache
        }
        throw err
      }
    }

    if (this.#cache.length > 0) {
      return this.#cache
    }

    throw new Error('No product catalog available: offline with no prior cache.')
  }

  /** Looks up a product by any of its barcodes from the current cache. */
  findByBarcode(barcode: string): Product | undefined {
    return this.#cache.find(p => p.barcode.includes(barcode))
  }

  /** ISO timestamp of the last successful live fetch, or null if never. */
  get lastFetchedAt(): string | null {
    return this.#lastFetchedAt
  }
}

export const inventoryService = new InventoryServiceImpl()
