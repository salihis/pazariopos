// server/src/schemas/sale.test.ts
// ─────────────────────────────────────────────────────────────
// Validates the runtime contract packages/core's salesApi actually
// sends over the wire (see this schema's own top comment: keep it
// structurally identical to domain.ts `Sale`).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { saleSchema } from './sale'

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1', sku: 'SKU-1', name: 'Ekmek', barcode: ['1111'],
    price: 1000, taxRate: 0.18, stock: 50, lowStockThreshold: 5,
    unit: 'piece', categoryId: 'cat-1', warehouseId: 'wh-1', isActive: true, costPrice: null,
    ...overrides,
  }
}

function validSale(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '',
    localId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    branchId: 'branch-1',
    registerId: 'register-1',
    cashierId: 'user-1',
    lines: [{
      product: product(), quantity: 2, unitPrice: 1000,
      discountAmount: 0, taxAmount: 180, total: 2360,
    }],
    payments: [{ method: 'cash', amount: 2360 }],
    subtotal: 2000, discountTotal: 0, taxTotal: 360, grandTotal: 2360, changeGiven: 0,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('saleSchema', () => {
  it('accepts a well-formed sale', () => {
    const result = saleSchema.safeParse(validSale())
    expect(result.success).toBe(true)
  })

  it('rejects a sale with zero lines', () => {
    const result = saleSchema.safeParse(validSale({ lines: [] }))
    expect(result.success).toBe(false)
  })

  it('rejects a sale with zero payments', () => {
    const result = saleSchema.safeParse(validSale({ payments: [] }))
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID localId (offline queue relies on real UUIDs for idempotency)', () => {
    const result = saleSchema.safeParse(validSale({ localId: 'not-a-uuid' }))
    expect(result.success).toBe(false)
  })

  it('rejects a negative discountAmount on a line', () => {
    const sale = validSale()
    sale.lines[0]!.discountAmount = -100
    const result = saleSchema.safeParse(sale)
    expect(result.success).toBe(false)
  })

  it('rejects a negative taxAmount on a line', () => {
    const sale = validSale()
    sale.lines[0]!.taxAmount = -1
    const result = saleSchema.safeParse(sale)
    expect(result.success).toBe(false)
  })

  it('rejects non-integer money fields (amounts are kuruş-integer, not float)', () => {
    const result = saleSchema.safeParse(validSale({ subtotal: 19.99 }))
    expect(result.success).toBe(false)
  })

  it('rejects an unknown payment method', () => {
    const sale = validSale()
    sale.payments[0]!.method = 'bitcoin' as any
    const result = saleSchema.safeParse(sale)
    expect(result.success).toBe(false)
  })

  it('rejects a negative payment amount', () => {
    const sale = validSale()
    sale.payments[0]!.amount = -500
    const result = saleSchema.safeParse(sale)
    expect(result.success).toBe(false)
  })

  it('rejects zero or negative quantity on a line', () => {
    const sale = validSale()
    sale.lines[0]!.quantity = 0
    expect(saleSchema.safeParse(sale).success).toBe(false)

    sale.lines[0]!.quantity = -1
    expect(saleSchema.safeParse(sale).success).toBe(false)
  })

  it('accepts a fractional quantity (kg/lt-sold products)', () => {
    const sale = validSale()
    sale.lines[0]!.quantity = 0.5
    expect(saleSchema.safeParse(sale).success).toBe(true)
  })

  it('accepts an optional customerId and rejects nothing extra when present', () => {
    const result = saleSchema.safeParse(validSale({ customerId: 'cust-1' }))
    expect(result.success).toBe(true)
  })

  it('rejects an invalid sale status', () => {
    const result = saleSchema.safeParse(validSale({ status: 'shipped' }))
    expect(result.success).toBe(false)
  })
})
