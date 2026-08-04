// server/src/schemas/finance.ts
// ─────────────────────────────────────────────────────────────
// Validation for the Gelir/Gider & Finans Phase 1 endpoints:
// categories, cash register movements/counts, bank transactions.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense', 'product']),
  parentId: z.string().optional(),
})

export const createCashRegisterSchema = z.object({
  name: z.string().min(1).default('Ana Kasa'),
})

export const recordCashMovementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount: z.number().int().positive(),
  categoryId: z.string().optional(),
  description: z.string().default(''),
})

export const recordCashCountSchema = z.object({
  countedAmount: z.number().int().nonnegative(),
  notes: z.string().default(''),
})

export const createBankAccountSchema = z.object({
  name: z.string().min(1),
  iban: z.string().optional(),
  bankName: z.string().optional(),
})

export const recordBankTransactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal']),
  amount: z.number().int().positive(),
  categoryId: z.string().optional(),
  description: z.string().default(''),
})

// ── Çek/Senet (Phase 2) ──

export const createChequeSchema = z.object({
  type: z.enum(['customer_cheque', 'own_cheque']),
  amount: z.number().int().positive(),
  chequeNumber: z.string().optional(),
  drawerName: z.string().min(1),
  bankName: z.string().optional(),
  dueDate: z.string(),   // ISO date string
  accountId: z.string().optional(),
  notes: z.string().default(''),
})

// Allowed forward transitions — terminal states (collected/returned/protested)
// have no further transitions.
const ALLOWED_CHEQUE_TRANSITIONS: Record<string, string[]> = {
  in_wallet: ['at_bank', 'collected', 'returned', 'protested'],
  at_bank: ['collected', 'returned', 'protested'],
}

export const updateChequeStatusSchema = z.object({
  status: z.enum(['in_wallet', 'at_bank', 'collected', 'returned', 'protested']),
})

export function isAllowedChequeTransition(from: string, to: string): boolean {
  return ALLOWED_CHEQUE_TRANSITIONS[from]?.includes(to) ?? false
}
