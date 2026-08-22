// server/src/schemas/stockCount.ts
// ─────────────────────────────────────────────────────────────
// Validation for the Stok Sayım (physical inventory count) routes.
// See server/prisma/schema.prisma's StockCount/StockCountItem
// comment for the draft → completed lifecycle this backs.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const startStockCountSchema = z.object({
  warehouseId: z.string().default('default'),
})

// POST /api/stock-counts/:id/items — upsert the counted quantity for
// one product. Identified by productId (already resolved client-side
// via barcode lookup or the name-search dropdown — same as PosScreen's
// product search), not by barcode/name, so this route doesn't need to
// duplicate that lookup logic.
export const upsertStockCountItemSchema = z.object({
  productId: z.string().min(1),
  countedStock: z.number().int().nonnegative(),
})

export type StartStockCountInput = z.infer<typeof startStockCountSchema>
export type UpsertStockCountItemInput = z.infer<typeof upsertStockCountItemSchema>
