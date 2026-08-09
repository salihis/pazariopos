// server/src/mappers/financeMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts Prisma Category/CashRegister/CashMovement/CashCount/
// BankAccount/BankTransaction rows into the exact wire shapes
// packages/core/src/types/domain.ts defines.
// ─────────────────────────────────────────────────────────────

import type {
  Category as PrismaCategory,
  CashRegister as PrismaCashRegister,
  CashMovement as PrismaCashMovement,
  CashCount as PrismaCashCount,
  BankAccount as PrismaBankAccount,
  BankTransaction as PrismaBankTransaction,
  Cheque as PrismaCheque,
} from '@prisma/client'
import type {
  Category, CashRegister, CashMovement, CashCount, BankAccount, BankTransaction, Cheque,
} from '@pazariopos/core/types'

export function toDomainCategory(row: PrismaCategory): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toDomainCashRegister(row: PrismaCashRegister): CashRegister {
  return {
    id: row.id,
    name: row.name,
    balance: row.balance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toDomainCashMovement(row: PrismaCashMovement): CashMovement {
  return {
    id: row.id,
    cashRegisterId: row.cashRegisterId,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    referenceSaleId: row.referenceSaleId,
    referencePurchaseId: row.referencePurchaseId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDomainCashCount(row: PrismaCashCount): CashCount {
  return {
    id: row.id,
    cashRegisterId: row.cashRegisterId,
    expectedAmount: row.expectedAmount,
    countedAmount: row.countedAmount,
    difference: row.difference,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDomainBankAccount(row: PrismaBankAccount): BankAccount {
  return {
    id: row.id,
    name: row.name,
    iban: row.iban,
    bankName: row.bankName,
    balance: row.balance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toDomainBankTransaction(row: PrismaBankTransaction): BankTransaction {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDomainCheque(row: PrismaCheque): Cheque {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    chequeNumber: row.chequeNumber,
    drawerName: row.drawerName,
    bankName: row.bankName,
    dueDate: row.dueDate.toISOString(),
    accountId: row.accountId,
    referenceSaleId: row.referenceSaleId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
