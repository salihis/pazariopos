// packages/core/src/store/useAccountStore.ts
// ─────────────────────────────────────────────────────────────
// Cari Hesap (Accounts Receivable/Payable) store — Phase 1.
// Thin wrapper around accountsApi, following the same shape as
// useInventoryStore.ts. No offline handling here yet: account list/
// detail reads are safe to go stale in principle (unlike the live
// balance check in AccountBalanceService), but this store doesn't
// cache — it always hits the network. Add caching if/when the Cari
// Hesap screen needs to work offline.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { Account, AccountTransaction } from '../types/domain'
import { accountsApi, type CreateAccountInput } from '../api/salesApi'

export interface AccountStoreState {
  accounts: Account[]
  isLoading: boolean
  error: string | null

  selectedAccount: Account | null
  transactions: AccountTransaction[]
  isLoadingTransactions: boolean

  loadAccounts(type?: Account['type']): Promise<void>
  createAccount(input: CreateAccountInput): Promise<Account>
  recordPayment(accountId: string, amount: number, description?: string): Promise<void>
  selectAccount(accountId: string): Promise<void>
  clearSelection(): void
}

export const useAccountStore = create<AccountStoreState>()((set, get) => ({
  accounts: [],
  isLoading: false,
  error: null,

  selectedAccount: null,
  transactions: [],
  isLoadingTransactions: false,

  async loadAccounts(type) {
    set({ isLoading: true, error: null })
    try {
      const accounts = await accountsApi.listAccounts(type)
      set({ accounts, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  async createAccount(input) {
    const account = await accountsApi.createAccount(input)
    set({ accounts: [...get().accounts, account].sort((a, b) => a.name.localeCompare(b.name)) })
    return account
  },

  async recordPayment(accountId, amount, description) {
    const result = await accountsApi.recordPayment(accountId, { amount, description })

    // Refresh the account list (balance changed) and, if this account is
    // currently selected, its ledger too (new payment transaction + any
    // invoices that just got matched/closed).
    set({
      accounts: get().accounts.map(a => (a.id === accountId ? result.account : a)),
    })

    if (get().selectedAccount?.id === accountId) {
      await get().selectAccount(accountId)
    }
  },

  async selectAccount(accountId) {
    set({ isLoadingTransactions: true })
    try {
      const [account, transactions] = await Promise.all([
        accountsApi.getAccount(accountId),
        accountsApi.getTransactions(accountId),
      ])
      set({ selectedAccount: account, transactions, isLoadingTransactions: false })
    } catch (err) {
      set({ isLoadingTransactions: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  clearSelection() {
    set({ selectedAccount: null, transactions: [] })
  },
}))
