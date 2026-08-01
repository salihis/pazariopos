// packages/core/src/store/useFinanceStore.ts
// ─────────────────────────────────────────────────────────────
// Gelir/Gider & Finans store — Phase 1. Thin wrapper around
// categoriesApi/cashRegistersApi/bankAccountsApi, following the same
// shape as useInventoryStore.ts / useAccountStore.ts.
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand'

import type { Category, CashRegister, BankAccount } from '../types/domain'
import { categoriesApi, cashRegistersApi, bankAccountsApi } from '../api/salesApi'

export interface FinanceStoreState {
  categories: Category[]
  cashRegisters: CashRegister[]
  bankAccounts: BankAccount[]
  isLoading: boolean
  error: string | null

  loadAll(): Promise<void>
  recordCashMovement(registerId: string, type: 'in' | 'out', amount: number, description?: string): Promise<void>
  recordCashCount(registerId: string, countedAmount: number, notes?: string): Promise<{ difference: number }>
  recordBankTransaction(bankAccountId: string, type: 'deposit' | 'withdrawal', amount: number, description?: string): Promise<void>
}

export const useFinanceStore = create<FinanceStoreState>()((set, get) => ({
  categories: [],
  cashRegisters: [],
  bankAccounts: [],
  isLoading: false,
  error: null,

  async loadAll() {
    set({ isLoading: true, error: null })
    try {
      const [categories, cashRegisters, bankAccounts] = await Promise.all([
        categoriesApi.listCategories(),
        cashRegistersApi.listCashRegisters(),
        bankAccountsApi.listBankAccounts(),
      ])
      set({ categories, cashRegisters, bankAccounts, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  async recordCashMovement(registerId, type, amount, description) {
    const { register } = await cashRegistersApi.recordMovement(registerId, { type, amount, description })
    set({ cashRegisters: get().cashRegisters.map(r => (r.id === registerId ? register : r)) })
  },

  async recordCashCount(registerId, countedAmount, notes) {
    const count = await cashRegistersApi.recordCount(registerId, countedAmount, notes)
    return { difference: count.difference }
  },

  async recordBankTransaction(bankAccountId, type, amount, description) {
    const { account } = await bankAccountsApi.recordTransaction(bankAccountId, { type, amount, description })
    set({ bankAccounts: get().bankAccounts.map(a => (a.id === bankAccountId ? account : a)) })
  },
}))
