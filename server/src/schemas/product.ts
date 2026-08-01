// server/src/schemas/product.ts
// ─────────────────────────────────────────────────────────────
// Validation for POST /api/products and PATCH /api/products/:id/stock.
// Mirrors packages/core/src/types/domain.ts `Product` — see
// server/src/schemas/sale.ts for why these aren't code-generated
// from one source (keeping the server dependency-light).
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  barcode: z.array(z.string()).default([]),
  price: z.number().int().nonnegative(),
  taxRate: z.number().min(0).max(1),
  stock: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(0),
  unit: z.enum(['piece', 'box', 'kg', 'lt']).default('piece'),
  categoryId: z.string().default(''),
  warehouseId: z.string().default('default'),
})

export const adjustStockSchema = z.object({
  // Positive = restock/purchase-in, negative = manual correction/shrinkage.
  // Sale-driven decrements happen inside the sales route's own transaction,
  // not through this endpoint.
  delta: z.number().int(),
  reason: z.string().min(1),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type AdjustStockInput = z.infer<typeof adjustStockSchema>
