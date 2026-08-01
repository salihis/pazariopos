// packages/core/src/store/useInventoryStore.ts
// ─────────────────────────────────────────────────────────────
// Product catalog store (Inventory MVP). Thin wrapper around
// InventoryService — the store's job is just to hold the result in
// React-reactive state and expose loading/error status to the UI.
// See InventoryService.ts for the actual online/offline logic.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { Product } from '../types/domain'
import { inventoryService } from '../services/InventoryService'

export interface InventoryStoreState {
  products: Product[]
  isLoading: boolean
  error: string | null
  lastFetchedAt: string | null

  /** Fetches (or re-fetches) the catalog. Safe to call repeatedly. */
  loadProducts(): Promise<void>

  /** Looks up a product by barcode from whatever is currently loaded. */
  findByBarcode(barcode: string): Product | undefined
}

export const useInventoryStore = create<InventoryStoreState>()((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  async loadProducts() {
    set({ isLoading: true, error: null })
    try {
      const products = await inventoryService.listProducts()
      set({
        products,
        isLoading: false,
        lastFetchedAt: inventoryService.lastFetchedAt,
      })
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  findByBarcode(barcode) {
    return get().products.find(p => p.barcode.includes(barcode))
  },
}))
