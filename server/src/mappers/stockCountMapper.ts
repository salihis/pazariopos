// server/src/mappers/stockCountMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `StockCount` row (with items included) into
// packages/core/src/types/domain.ts's `StockCount` shape. See
// saleMapper.ts for why this project hand-writes this bridge instead
// of code-generating it.
// ─────────────────────────────────────────────────────────────

import type { StockCount as PrismaStockCount, StockCountItem as PrismaStockCountItem } from '@prisma/client'
import type { StockCount, StockCountItem } from '@pazariopos/core/types'

type StockCountRow = PrismaStockCount & { items: PrismaStockCountItem[] }

export function toDomainStockCountItem(row: PrismaStockCountItem): StockCountItem {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    productSku: row.productSku,
    previousStock: row.previousStock,
    countedStock: row.countedStock,
    countedAt: row.countedAt.toISOString(),
  }
}

export function toDomainStockCount(row: StockCountRow): StockCount {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    status: row.status,
    userId: row.userId,
    items: row.items.map(toDomainStockCountItem),
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
