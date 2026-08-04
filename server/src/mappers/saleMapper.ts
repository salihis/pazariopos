// server/src/mappers/saleMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `Sale` row (with `lines`/`payments` included)
// back into the exact wire shape `packages/core/src/types/domain.ts`
// defines. The client only ever sees this shape — it never touches
// the relational structure directly.
//
// Note: SaleLine.productId/productName are a denormalized snapshot;
// this mapper does NOT re-fetch the live Product record, since the
// receipt must reflect the price/name at time of sale, not today's.
// A full `Product` is reconstructed with placeholder fields for
// anything not persisted (see comment below) — swap for a real
// products table lookup once the Inventory module exists.
// ─────────────────────────────────────────────────────────────

import type { Sale as PrismaSale, SaleLine as PrismaSaleLine, SalePayment as PrismaSalePayment } from '@prisma/client'
// Deliberately importing from '@pazariopos/core/types', NOT the root '@pazariopos/core'
// barrel: the root barrel also re-exports browser-facing classes (BarcodeService,
// NetworkMonitor, etc.) that reference `window`/`document`/`KeyboardEvent`. Since
// the server has no DOM lib in its tsconfig, pulling those into this Program's
// module graph fails to typecheck even though this file only needs plain types.
import type { Sale, CartLine, PaymentLine, PaymentMethod } from '@pazariopos/core/types'

type PrismaSaleWithRelations = PrismaSale & {
  lines: PrismaSaleLine[]
  payments: PrismaSalePayment[]
}

function toCartLine(line: PrismaSaleLine): CartLine {
  return {
    // The Inventory module (not yet built — see ARCHITECTURE.md §2)
    // will own the authoritative Product record. Until then we
    // reconstruct only the fields the receipt template actually
    // renders (name, price); the rest are structurally required but
    // functionally unused placeholders.
    product: {
      id: line.productId,
      sku: line.productId,
      name: line.productName,
      barcode: [],
      price: line.unitPrice,
      // unitPrice and taxAmount are both stored PER-UNIT (see routes/sales.ts —
      // it persists CartLine.unitPrice/taxAmount directly, only `total` is
      // multiplied by quantity), so this must NOT also divide by quantity.
      taxRate: line.unitPrice > 0 ? line.taxAmount / line.unitPrice : 0,
      stock: 0,
      lowStockThreshold: 0,
      unit: 'piece',
      categoryId: null,
      warehouseId: '',
      isActive: true,
    },
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxAmount: line.taxAmount,
    total: line.total,
  }
}

function toPaymentLine(payment: PrismaSalePayment): PaymentLine {
  return {
    method: payment.method as PaymentMethod,
    amount: payment.amount,
    reference: payment.reference ?? undefined,
  }
}

export function toDomainSale(row: PrismaSaleWithRelations): Sale {
  return {
    id: row.id,
    localId: row.localId,
    branchId: row.branchId,
    registerId: row.registerId,
    cashierId: row.cashierId,
    customerId: row.customerId ?? undefined,

    lines: row.lines.map(toCartLine),
    payments: row.payments.map(toPaymentLine),

    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    grandTotal: row.grandTotal,
    changeGiven: row.changeGiven,

    status: row.status,

    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),

    deviceId: row.deviceId ?? undefined,
    syncStatus: row.syncStatus,
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
  }
}
