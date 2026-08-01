// server/src/schemas/sale.ts
// ─────────────────────────────────────────────────────────────
// Runtime validation for the wire format sent by
// packages/core/src/api/salesApi.ts (createSale / syncSale).
//
// Kept structurally identical to packages/core/src/types/domain.ts
// `Sale`. If you change one, change the other — there is currently
// no code generation bridging them (see ARCHITECTURE.md §2 for the
// rationale: keeping the server dependency-light).
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

const productSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  barcode: z.array(z.string()),
  price: z.number().int(),
  taxRate: z.number(),
  stock: z.number(),
  lowStockThreshold: z.number(),
  unit: z.enum(['piece', 'box', 'kg', 'lt']),
  categoryId: z.string(),
  warehouseId: z.string(),
})

const cartLineSchema = z.object({
  product: productSchema,
  quantity: z.number().positive(),
  unitPrice: z.number().int(),
  discountAmount: z.number().int().nonnegative(),
  taxAmount: z.number().int().nonnegative(),
  total: z.number().int(),
})

const paymentLineSchema = z.object({
  method: z.enum(['cash', 'card', 'transfer', 'cheque', 'account']),
  amount: z.number().int().nonnegative(),
  reference: z.string().optional(),
})

export const saleSchema = z.object({
  id: z.string(),          // empty string accepted for not-yet-persisted drafts
  localId: z.string().uuid(),
  branchId: z.string(),
  registerId: z.string(),
  cashierId: z.string(),
  customerId: z.string().optional(),

  lines: z.array(cartLineSchema).min(1, 'Sale must contain at least one line'),
  payments: z.array(paymentLineSchema).min(1, 'Sale must contain at least one payment'),

  subtotal: z.number().int(),
  discountTotal: z.number().int(),
  taxTotal: z.number().int(),
  grandTotal: z.number().int(),
  changeGiven: z.number().int(),

  status: z.enum(['completed', 'returned', 'partial_return', 'voided']),

  createdAt: z.string(),
  updatedAt: z.string(),

  deviceId: z.string().optional(),
  syncStatus: z.enum(['synced', 'pending', 'conflict', 'error']).optional(),
  syncedAt: z.string().nullable().optional(),
})

export type SaleInput = z.infer<typeof saleSchema>
