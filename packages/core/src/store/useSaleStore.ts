// packages/core/src/store/useSaleStore.ts
// ─────────────────────────────────────────────────────────────
// Central sale-flow store (Zustand v5).
//
// Implements architecture doc §7 "OFFLINE MODE" rules exactly:
//
//   • ONLINE  → POST the sale straight to the Fastify API.
//   • OFFLINE → enqueue locally (SQLite on desktop / memory on web)
//               and let the reconnect handler auto-sync later.
//   • Sales & Inventory may operate offline.
//   • Account balance reads MUST throw when offline (see
//     AccountBalanceService / OfflineBalanceError) — this store
//     never catches-and-silently-continues that error; it lets it
//     propagate so the calling UI can block the sale.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { StoreApi } from 'zustand'

import type { Sale, CartLine, PaymentLine, NetworkStatus } from '../types/domain'
import { salesApi }                        from '../api/salesApi'
import { getNetworkMonitor }                from '../services/NetworkMonitor'
import { getLocalSaleQueue }                from '../services/localSaleQueueFactory'
import { accountBalanceService }            from '../services/AccountBalanceService'
import { platform }                         from '../platform/PlatformDetectionService'
import { useAuthStore }                     from './useAuthStore'

// ── Public types ─────────────────────────────────────────────

export type SaleSubmitOutcome =
  | { mode: 'online'; sale: Sale }
  | { mode: 'queued'; sale: Sale }

// One customer's draft — see SaleStoreState.slots for why there are
// several of these at once.
export interface SaleSlot {
  cart: CartLine[]
  customerId: string | null
}

export const SALE_SLOT_COUNT = 4

function emptySlots(): SaleSlot[] {
  return Array.from({ length: SALE_SLOT_COUNT }, () => ({ cart: [], customerId: null }))
}

export interface SaleStoreState {
  // ── Multi-customer "tabs" — a cashier can hold up to SALE_SLOT_COUNT
  //    concurrent draft sales (e.g. customer 2 is mid-order while
  //    customer 1 is still deciding), and switch between them without
  //    losing either cart. `cart` / `customerId` below always mirror
  //    `slots[activeSlotIndex]` — every other store consumer keeps
  //    reading those two fields exactly as before; only PosScreen's new
  //    tab bar needs to know about `slots` / `activeSlotIndex` at all. ──
  slots: SaleSlot[]
  activeSlotIndex: number

  // Current draft cart — mirrors slots[activeSlotIndex]; write through
  // the actions below, never assign this directly.
  cart: CartLine[]
  customerId: string | null

  // Network / sync bookkeeping
  networkStatus: NetworkStatus
  pendingCount: number          // sales sitting in the offline queue
  isSyncing: boolean
  lastSyncError: string | null
  lastSubmittedSale: Sale | null

  // ── Cart actions (act on the ACTIVE slot) ──
  addLine(line: CartLine): void
  removeLine(productId: string): void
  clearCart(): void
  setCustomer(customerId: string | null): void

  // ── Slot (multi-customer tab) switching ──
  setActiveSlot(index: number): void

  // ── Sale submission (the core offline/online branch) ──
  submitSale(payments: PaymentLine[]): Promise<SaleSubmitOutcome>

  // ── Account balance (must fail offline — no silent fallback) ──
  checkAccountBalance(accountId: string): Promise<number>

  // ── Sync engine ──
  syncPendingSales(): Promise<void>

  // ── Lifecycle ──
  init(): () => void   // returns a teardown function
}

type SetFn = StoreApi<SaleStoreState>['setState']
type GetFn = StoreApi<SaleStoreState>['getState']

// ── Pure helpers (no store access — easy to unit test) ───────

function computeTotals(lines: CartLine[]) {
  const subtotal      = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
  const discountTotal = lines.reduce((sum, l) => sum + l.discountAmount * l.quantity, 0)
  const taxTotal      = lines.reduce((sum, l) => sum + l.taxAmount * l.quantity, 0)
  const grandTotal    = subtotal - discountTotal + taxTotal
  return { subtotal, discountTotal, taxTotal, grandTotal }
}

function buildDraftSale(
  lines: CartLine[],
  payments: PaymentLine[],
  customerId: string | null,
): Sale {
  const { subtotal, discountTotal, taxTotal, grandTotal } = computeTotals(lines)
  const paid = payments.reduce((sum, p) => sum + p.amount, 0)

  // Auth Phase 1: cashierId now comes from the logged-in user rather than
  // a hardcoded placeholder. Falls back to 'UNKNOWN_CASHIER' only if a
  // sale is somehow submitted with no session — this shouldn't normally
  // be reachable once the UI gates checkout behind login, but a sale
  // record must always have SOME cashierId rather than crash.
  const cashierId = useAuthStore.getState().currentUser?.id ?? 'UNKNOWN_CASHIER'

  return {
    id: '',                              // assigned by the server on success
    localId: crypto.randomUUID(),
    branchId: 'BRANCH_DEFAULT',          // wire up from session/auth context in production
    registerId: 'REGISTER_1',
    cashierId,
    customerId: customerId ?? undefined,
    lines,
    payments,
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    changeGiven: Math.max(0, paid - grandTotal),
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deviceId: platform.type,
    syncStatus: 'pending',
    syncedAt: null,
  }
}

// ── Module-level action helpers (take set/get explicitly) ────
// Kept outside the `create()` callback so they have clean, fully
// inferred types instead of relying on `this` inside a store method.

async function enqueueOffline(set: SetFn, get: GetFn, draft: Sale): Promise<SaleSubmitOutcome> {
  const queue = getLocalSaleQueue()
  await queue.enqueue(draft)

  const pending = await queue.listPending()
  const { activeSlotIndex } = get()
  set(state => ({
    pendingCount: pending.length,
    lastSubmittedSale: draft,
    slots: state.slots.map((slot, i) => (i === activeSlotIndex ? { cart: [], customerId: null } : slot)),
    cart: [],
    customerId: null,
  }))

  return { mode: 'queued', sale: draft }
}

async function submitSaleAction(
  set: SetFn,
  get: GetFn,
  payments: PaymentLine[],
): Promise<SaleSubmitOutcome> {
  const { cart, customerId, networkStatus, activeSlotIndex } = get()
  if (cart.length === 0) {
    throw new Error('Cannot submit an empty sale.')
  }

  const draft = buildDraftSale(cart, payments, customerId)

  // ── ONLINE branch ──
  if (networkStatus === 'online') {
    try {
      const persisted = await salesApi.createSale({ ...draft, syncStatus: 'synced' })
      set(state => ({
        lastSubmittedSale: persisted,
        slots: state.slots.map((slot, i) => (i === activeSlotIndex ? { cart: [], customerId: null } : slot)),
        cart: [],
        customerId: null,
      }))
      return { mode: 'online', sale: persisted }
    } catch (err) {
      // Connection dropped mid-request (race between check and send) —
      // fall back to the offline queue instead of losing the sale.
      console.warn('[useSaleStore] Online submit failed, falling back to queue:', err)
      return enqueueOffline(set, get, draft)
    }
  }

  // ── OFFLINE branch ──
  return enqueueOffline(set, get, draft)
}

async function syncPendingSalesAction(set: SetFn, get: GetFn): Promise<void> {
  if (get().isSyncing) return
  if (get().networkStatus !== 'online') return

  set({ isSyncing: true, lastSyncError: null })
  const queue = getLocalSaleQueue()

  try {
    const pending = await queue.listPending()

    for (const item of pending) {
      try {
        const sale = JSON.parse(item.payload) as Sale
        const synced = await salesApi.syncSale(sale)
        await queue.markCompleted(item.id, synced.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await queue.markFailed(item.id, message)
        set({ lastSyncError: message })
        // Keep going — one bad record shouldn't block the rest of the queue.
      }
    }

    const remaining = await queue.listPending()
    set({ pendingCount: remaining.length })
  } finally {
    set({ isSyncing: false })
  }
}

// ── Store ────────────────────────────────────────────────────

export const useSaleStore = create<SaleStoreState>()(
  subscribeWithSelector((set, get) => ({
    slots: emptySlots(),
    activeSlotIndex: 0,
    cart: [],
    customerId: null,

    networkStatus: 'offline',
    pendingCount: 0,
    isSyncing: false,
    lastSyncError: null,
    lastSubmittedSale: null,

    // ── Cart actions — always act on the ACTIVE slot, and keep the
    //    top-level cart/customerId mirror in sync with it. ──────────

    addLine(line) {
      set(state => {
        const activeCart = state.slots[state.activeSlotIndex]?.cart ?? []
        const existing = activeCart.find(l => l.product.id === line.product.id)
        const nextCart = existing
          ? activeCart.map(l =>
              l.product.id === line.product.id
                ? { ...l, quantity: l.quantity + line.quantity, total: l.total + line.total }
                : l,
            )
          : [...activeCart, line]

        return {
          slots: state.slots.map((slot, i) => (i === state.activeSlotIndex ? { ...slot, cart: nextCart } : slot)),
          cart: nextCart,
        }
      })
    },

    removeLine(productId) {
      set(state => {
        const nextCart = (state.slots[state.activeSlotIndex]?.cart ?? []).filter(l => l.product.id !== productId)
        return {
          slots: state.slots.map((slot, i) => (i === state.activeSlotIndex ? { ...slot, cart: nextCart } : slot)),
          cart: nextCart,
        }
      })
    },

    clearCart() {
      set(state => ({
        slots: state.slots.map((slot, i) => (i === state.activeSlotIndex ? { cart: [], customerId: null } : slot)),
        cart: [],
        customerId: null,
      }))
    },

    setCustomer(customerId) {
      set(state => ({
        slots: state.slots.map((slot, i) => (i === state.activeSlotIndex ? { ...slot, customerId } : slot)),
        customerId,
      }))
    },

    // ── Slot switching — e.g. cashier taps "Müşteri 2" while Müşteri
    //    1's order is still open. No data is lost; each slot keeps its
    //    own cart/customer until its sale is submitted. ──────────────

    setActiveSlot(index) {
      set(state => {
        const slot = state.slots[index]
        if (!slot) return {}
        return { activeSlotIndex: index, cart: slot.cart, customerId: slot.customerId }
      })
    },

    // ── Sale submission ───────────────────────────────────────

    submitSale(payments) {
      return submitSaleAction(set, get, payments)
    },

    // ── Account balance — MUST throw when offline ─────────────

    async checkAccountBalance(accountId) {
      // Intentionally NOT wrapped in try/catch-and-swallow: architecture
      // rule requires this to fail loudly offline. Callers (UI) decide
      // how to present OfflineBalanceError to the cashier.
      const result = await accountBalanceService.getBalance(accountId)
      return result.balance
    },

    // ── Sync engine ────────────────────────────────────────────

    syncPendingSales() {
      return syncPendingSalesAction(set, get)
    },

    // ── Lifecycle ──────────────────────────────────────────────

    init() {
      const monitor = getNetworkMonitor()
      const queue = getLocalSaleQueue()

      set({ networkStatus: monitor.status })

      // Seed pendingCount from whatever survived a previous session
      // (the desktop SQLite queue persists across app restarts).
      void queue.listPending().then(items => set({ pendingCount: items.length }))

      const unsubscribe = monitor.onStatusChange(status => {
        const wasOffline = get().networkStatus !== 'online'
        set({ networkStatus: status })

        // Reconnect trigger: offline -> online transition auto-syncs
        // the queue, per architecture §7 "Reconnect" behavior.
        if (wasOffline && status === 'online') {
          void get().syncPendingSales()
        }
      })

      return unsubscribe
    },
  })),
)

// Re-exported so UI code can do:
//   try { await checkAccountBalance(id) } catch (e) { if (e instanceof OfflineBalanceError) ... }
export { OfflineBalanceError } from '../services/AccountBalanceService'
