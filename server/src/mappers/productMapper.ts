// server/src/mappers/productMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `Product` row into the exact wire shape
// packages/core/src/types/domain.ts defines. See saleMapper.ts
// for why this project doesn't code-generate this bridge.
// ─────────────────────────────────────────────────────────────

import type { Product as PrismaProduct } from '@prisma/client'
import type { Product } from '@pazariopos/core/types'

export function toDomainProduct(row: PrismaProduct): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    barcode: row.barcode,
    price: row.price,
    taxRate: row.taxRate,
    stock: row.stock,
    lowStockThreshold: row.lowStockThreshold,
    unit: row.unit,
    categoryId: row.categoryId,
    warehouseId: row.warehouseId,
  }
}
