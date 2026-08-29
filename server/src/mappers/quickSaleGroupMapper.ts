// server/src/mappers/quickSaleGroupMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `QuickSaleGroup` row into the exact wire shape
// packages/core/src/types/domain.ts defines.
// ─────────────────────────────────────────────────────────────

import type { QuickSaleGroup as PrismaQuickSaleGroup } from '@prisma/client'
import type { QuickSaleGroup } from '@pazariopos/core/types'

export function toDomainQuickSaleGroup(row: PrismaQuickSaleGroup): QuickSaleGroup {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
