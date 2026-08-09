// server/src/mappers/accountMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts Prisma `Account` / `AccountTransaction` rows into the
// exact wire shapes packages/core/src/types/domain.ts defines.
// See saleMapper.ts for why this project doesn't code-generate
// this bridge.
// ─────────────────────────────────────────────────────────────

import type { Account as PrismaAccount, AccountTransaction as PrismaAccountTransaction } from '@prisma/client'
import type { Account, AccountTransaction } from '@pazariopos/core/types'

export function toDomainAccount(row: PrismaAccount): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    taxNumber: row.taxNumber ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    ibanList: row.ibanList,
    creditLimit: row.creditLimit,
    paymentTermDays: row.paymentTermDays,
    discountRate: row.discountRate,
    balance: row.balance,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toDomainAccountTransaction(row: PrismaAccountTransaction): AccountTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.type,
    amount: row.amount,
    openAmount: row.openAmount,
    referenceSaleId: row.referenceSaleId ?? undefined,
    referencePurchaseId: row.referencePurchaseId ?? undefined,
    description: row.description,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}
