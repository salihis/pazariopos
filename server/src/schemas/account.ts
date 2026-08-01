// server/src/schemas/account.ts
// ─────────────────────────────────────────────────────────────
// Validation for POST /api/accounts (Cari Hesap Phase 1).
// Mirrors packages/core/src/types/domain.ts `Account` — see
// server/src/schemas/sale.ts for why these aren't code-generated
// from one source (keeping the server dependency-light).
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['customer', 'supplier', 'employee', 'other']).default('customer'),

  taxNumber: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  ibanList: z.array(z.string()).default([]),

  creditLimit: z.number().int().nonnegative().default(0),
  paymentTermDays: z.number().int().nonnegative().default(0),
  discountRate: z.number().min(0).max(1).default(0),
})

export const listAccountsQuerySchema = z.object({
  type: z.enum(['customer', 'supplier', 'employee', 'other']).optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
