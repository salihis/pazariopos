// server/src/mappers/saleMapper.test.ts
// ─────────────────────────────────────────────────────────────
// Focuses on toDomainSale's taxRate reconstruction
// (`line.taxAmount / line.unitPrice`) — this is the exact
// computation covered by the "KDV hesaplama düzeltmesi" checklist
// item, and it has a real division-by-zero edge case (free/0-priced
// lines) that's easy to regress.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { toDomainSale } from './saleMapper'

function baseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sale-1',
    localId: 'local-1',
    branchId: 'branch-1',
    registerId: 'register-1',
    cashierId: 'user-1',
    customerId: null,
    subtotal: 1000,
    discountTotal: 0,
    taxTotal: 180,
    grandTotal: 1180,
    changeGiven: 0,
    status: 'completed',
    deviceId: null,
    syncStatus: 'synced',
    syncedAt: new Date('2026-07-30T10:00:00.000Z'),
    createdAt: new Date('2026-07-30T10:00:00.000Z'),
    updatedAt: new Date('2026-07-30T10:00:00.000Z'),
    lines: [],
    payments: [],
    ...overrides,
  } as any
}

function saleLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    productId: 'prod-1',
    productName: 'Ekmek',
    quantity: 1,
    unitPrice: 1000,
    discountAmount: 0,
    taxAmount: 180,
    total: 1180,
    ...overrides,
  }
}

describe('toDomainSale — taxRate reconstruction (KDV)', () => {
  it('reconstructs the 18% VAT rate from per-unit price and tax amount', () => {
    const row = baseRow({ lines: [saleLine({ unitPrice: 1000, taxAmount: 180 })] })
    const sale = toDomainSale(row)
    expect(sale.lines[0]!.product.taxRate).toBeCloseTo(0.18, 10)
  })

  it('reconstructs the reduced 1% VAT rate (e.g. basic foodstuffs) correctly', () => {
    const row = baseRow({ lines: [saleLine({ unitPrice: 1000, taxAmount: 10 })] })
    const sale = toDomainSale(row)
    expect(sale.lines[0]!.product.taxRate).toBeCloseTo(0.01, 10)
  })

  it('does NOT divide by quantity — taxAmount and unitPrice are already per-unit', () => {
    // A 3x line at 1000/unit, 180/unit tax must still resolve to 0.18,
    // not 0.18 * 3 or 0.06 (the two ways this used to be miscalculated).
    const row = baseRow({ lines: [saleLine({ quantity: 3, unitPrice: 1000, taxAmount: 180, total: 3540 })] })
    const sale = toDomainSale(row)
    expect(sale.lines[0]!.product.taxRate).toBeCloseTo(0.18, 10)
  })

  it('returns 0 instead of NaN/Infinity when unitPrice is 0 (promo/free line)', () => {
    const row = baseRow({ lines: [saleLine({ unitPrice: 0, taxAmount: 0 })] })
    const sale = toDomainSale(row)
    expect(sale.lines[0]!.product.taxRate).toBe(0)
  })

  it('maps multiple lines with different VAT rates independently', () => {
    const row = baseRow({
      lines: [
        saleLine({ productId: 'p-18', unitPrice: 1000, taxAmount: 180 }),
        saleLine({ productId: 'p-1', unitPrice: 2000, taxAmount: 20 }),
      ],
    })
    const sale = toDomainSale(row)
    expect(sale.lines[0]!.product.taxRate).toBeCloseTo(0.18, 10)
    expect(sale.lines[1]!.product.taxRate).toBeCloseTo(0.01, 10)
  })

  it('maps top-level totals, timestamps, and optional fields through unchanged', () => {
    const row = baseRow({
      customerId: 'cust-9',
      lines: [saleLine()],
      payments: [{ method: 'cash', amount: 1180, reference: null }],
    })
    const sale = toDomainSale(row)

    expect(sale.subtotal).toBe(1000)
    expect(sale.taxTotal).toBe(180)
    expect(sale.grandTotal).toBe(1180)
    expect(sale.customerId).toBe('cust-9')
    expect(sale.createdAt).toBe('2026-07-30T10:00:00.000Z')
    expect(sale.payments[0]!).toEqual({ method: 'cash', amount: 1180, reference: undefined })
  })

  it('maps a null customerId to undefined (cash-only sale, no account)', () => {
    const row = baseRow({ customerId: null, lines: [saleLine()] })
    const sale = toDomainSale(row)
    expect(sale.customerId).toBeUndefined()
  })
})
