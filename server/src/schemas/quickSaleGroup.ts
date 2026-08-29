// server/src/schemas/quickSaleGroup.ts
// ─────────────────────────────────────────────────────────────
// Validation for POST /api/quick-sale-groups. Deliberately flat
// (no parentId) — see schema.prisma's QuickSaleGroup comment for why
// this is a separate, simpler table from Category.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const createQuickSaleGroupSchema = z.object({
  name: z.string().min(1),
})

export type CreateQuickSaleGroupInput = z.infer<typeof createQuickSaleGroupSchema>
