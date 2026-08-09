// server/src/mappers/purchaseMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `Purchase` row (with lines/payments included)
// into packages/core/src/types/domain.ts's `Purchase` shape. See
// saleMapper.ts for why this project hand-writes this bridge instead
// of code-generating it.
// ─────────────────────────────────────────────────────────────

import type { Purchase as PrismaPurchase, PurchaseLine as PrismaPurchaseLine, PurchasePayment as PrismaPurchasePayment } from '@prisma/client'
import type { Purchase } from '@pazariopos/core/types'

type PurchaseRow = PrismaPurchase & { lines: PrismaPurchaseLine[]; payments: PrismaPurchasePayment[] }

export function toDomainPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    supplierId: row.supplierId,
    warehouseId: row.warehouseId,
    userId: row.userId,

    lines: row.lines.map(line => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitCost: line.unitCost,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      total: line.total,
    })),
    payments: row.payments.map(p => ({
      method: p.method as Purchase['payments'][number]['method'],
      amount: p.amount,
      reference: p.reference ?? undefined,
    })),

    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    grandTotal: row.grandTotal,

    invoiceDate: row.invoiceDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
