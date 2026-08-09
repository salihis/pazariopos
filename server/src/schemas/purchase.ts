// server/src/schemas/purchase.ts
// ─────────────────────────────────────────────────────────────
// Runtime validation for POST /api/purchases. Unlike sale.ts, this
// does NOT embed a full Product snapshot per line — purchases are
// always created online at a desk (no offline-queue resilience
// requirement the way POS sales have), so a line can simply
// reference an existing productId. `productName` is still captured
// as a denormalized snapshot, same rationale as SaleLine.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

const purchaseLineSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().default(0),
  taxAmount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

const purchasePaymentSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'cheque', 'account']),
  amount: z.number().int().nonnegative(),
  reference: z.string().optional(),
})

export const purchaseSchema = z.object({
  invoiceNumber: z.string().optional(),
  supplierId: z.string().nullable().optional(), // null/omitted = "Firmasız"
  warehouseId: z.string().default('default'),
  invoiceDate: z.string(), // ISO date string

  lines: z.array(purchaseLineSchema).min(1, 'Purchase must contain at least one line'),
  payments: z.array(purchasePaymentSchema).min(1, 'Purchase must contain at least one payment'),

  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  taxTotal: z.number().int(),
  grandTotal: z.number().int(),
})

export type PurchaseInput = z.infer<typeof purchaseSchema>
