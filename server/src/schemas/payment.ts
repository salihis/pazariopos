// server/src/schemas/payment.ts
// ─────────────────────────────────────────────────────────────
// Validation for POST /api/accounts/:id/payments (Cari Hesap Phase 2).
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

// Explicit matches let a caller pay down specific invoices; if omitted,
// the server auto-matches oldest-open-invoice-first (see routes/accounts.ts).
const matchSchema = z.object({
  invoiceTransactionId: z.string().min(1),
  amount: z.number().int().positive(),
})

export const recordPaymentSchema = z.object({
  amount: z.number().int().positive(),
  description: z.string().default('Ödeme'),
  matches: z.array(matchSchema).optional(),
})

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
