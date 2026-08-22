// packages/core/src/store/useStockCountStore.ts
// ─────────────────────────────────────────────────────────────
// Stok Sayım (physical inventory count) store. Thin wrapper around
// stockCountsApi, following the same shape as useAccountStore.ts.
//
// The draft is server-persisted (see routes/stockCounts.ts) so that
// leaving this screen — e.g. to add a not-yet-catalogued product on
// ProductsPanel — and coming back resumes exactly where the user left
// off, even after a page reload or from a different device. This
// store's `loadOrStartDraft` is what the UI calls on mount to fetch
// (or silently create) that draft.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { StockCount } from '../types/domain'
import { stockCountsApi } from '../api/salesApi'

export interface StockCountStoreState {
  current: StockCount | null
  isLoading: boolean
  isSaving: boolean
  isCompleting: boolean
  error: string | null

  /** Fetches the caller's open draft, or starts a new one if none exists. */
  loadOrStartDraft(): Promise<void>
  /** Records/overwrites the counted quantity for one product. */
  countProduct(productId: string, countedStock: number): Promise<void>
  /** Removes a mis-scanned item from the count. */
  removeItem(productId: string): Promise<void>
  /** "Sayımı Aktar" — writes every counted item onto Product.stock and closes the count. */
  completeCount(): Promise<StockCount>
  /** Clears the finished count from view so the screen is ready for a new one. */
  clearCurrent(): void
}

export const useStockCountStore = create<StockCountStoreState>()((set, get) => ({
  current: null,
  isLoading: false,
  isSaving: false,
  isCompleting: false,
  error: null,

  async loadOrStartDraft() {
    set({ isLoading: true, error: null })
    try {
      const draft = await stockCountsApi.getDraft()
      const current = draft ?? await stockCountsApi.start()
      set({ current, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  async countProduct(productId, countedStock) {
    const { current } = get()
    if (!current) return
    set({ isSaving: true, error: null })
    try {
      const updated = await stockCountsApi.upsertItem(current.id, productId, countedStock)
      set({ current: updated, isSaving: false })
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  async removeItem(productId) {
    const { current } = get()
    if (!current) return
    set({ isSaving: true, error: null })
    try {
      const updated = await stockCountsApi.removeItem(current.id, productId)
      set({ current: updated, isSaving: false })
    } catch (err) {
      set({ isSaving: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  async completeCount() {
    const { current } = get()
    if (!current) throw new Error('Aktarılacak bir sayım yok.')
    set({ isCompleting: true, error: null })
    try {
      const completed = await stockCountsApi.complete(current.id)
      set({ current: completed, isCompleting: false })
      return completed
    } catch (err) {
      set({ isCompleting: false, error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  clearCurrent() {
    set({ current: null })
  },
}))
