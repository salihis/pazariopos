// server/src/routes/purchases.test.ts
// ─────────────────────────────────────────────────────────────
// Exercises routes/purchases.ts through real Fastify request/response
// (app.inject), with the Prisma client mocked (see test/prismaMock.ts).
// Covers the invariants the route's own top-of-file comment promises:
//   • Stock increment + supplier ledger + cash-register posting all run
//     inside ONE $transaction alongside the purchase insert.
//   • An 'account' (açık hesap) payment DECREASES the supplier's
//     balance (we now owe them more) — the mirror-image of sales.ts's
//     veresiye posting, which increases a customer's balance.
//   • A 'cash' payment posts money OUT of the register (type: 'out'),
//     the mirror-image of a cash sale's money IN.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createPrismaMock, type PrismaMock } from '../test/prismaMock'
import { buildTestApp, tokenFor } from '../test/buildTestApp'

let prismaMock: PrismaMock

vi.mock('../db/prisma', () => ({
  get prisma() {
    return prismaMock.prisma
  },
}))

function validPurchasePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    invoiceNumber: 'ALF-2026-000123',
    supplierId: null as string | null,
    warehouseId: 'default',
    invoiceDate: new Date().toISOString(),
    lines: [{
      productId: 'prod-1', productName: 'Ekmek Unu 50kg',
      quantity: 10, unitCost: 15000, discountAmount: 0, taxAmount: 2500, total: 150000,
    }],
    payments: [{ method: 'cash', amount: 150000 }],
    subtotal: 127500, discountTotal: 0, taxTotal: 22500, grandTotal: 150000,
    ...overrides,
  }
}

function fakePurchaseRow(input: ReturnType<typeof validPurchasePayload>) {
  return {
    id: 'purchase-db-id-1',
    invoiceNumber: input.invoiceNumber,
    supplierId: input.supplierId,
    warehouseId: input.warehouseId,
    userId: 'user-1',
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    taxTotal: input.taxTotal,
    grandTotal: input.grandTotal,
    invoiceDate: new Date(input.invoiceDate),
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: input.lines,
    payments: input.payments.map((p: any) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null })),
  }
}

describe('POST /api/purchases', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { purchasesRoutes } = await import('./purchases')
    app = await buildTestApp(purchasesRoutes, '/api/purchases')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('rejects requests with no Authorization header (401)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/purchases', payload: validPurchasePayload() })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a role not permitted to create purchases (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'cashier' })}` },
      payload: validPurchasePayload(),
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a malformed payload with 400 and does not touch the DB', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { ...validPurchasePayload(), lines: [] },
    })
    expect(res.statusCode).toBe(400)
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('persists a cash purchase, increments stock, updates cost price, and posts money OUT of the register', async () => {
    const payload = validPurchasePayload()
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue({ id: 'default-cash-register', balance: 500000 })

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(1)

    // Stock incremented (opposite of a sale) and cost price refreshed
    // to this purchase's unit cost.
    expect(prismaMock.tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: { increment: 10 }, costPrice: 15000 },
    })

    // Cash payment posted OUT of the register (mirror of a sale's IN).
    expect(prismaMock.tx.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cashRegisterId: 'default-cash-register',
          type: 'out',
          amount: 150000,
          referencePurchaseId: 'purchase-db-id-1',
        }),
      }),
    )
    expect(prismaMock.tx.cashRegister.update).toHaveBeenCalledWith({
      where: { id: 'default-cash-register' },
      data: { balance: { decrement: 150000 } },
    })

    // No supplier on a cash purchase -> no ledger entry.
    expect(prismaMock.tx.account.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.tx.accountTransaction.create).not.toHaveBeenCalled()
  })

  it('increments stock once per line, with each line\'s own quantity, for multi-line purchases', async () => {
    const payload = validPurchasePayload({
      lines: [
        { productId: 'prod-A', productName: 'A', quantity: 5, unitCost: 1000, discountAmount: 0, taxAmount: 100, total: 5100 },
        { productId: 'prod-B', productName: 'B', quantity: 20, unitCost: 500, discountAmount: 0, taxAmount: 100, total: 10100 },
      ],
      payments: [{ method: 'cash', amount: 15200 }],
    })
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue({ id: 'default-cash-register', balance: 0 })

    await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'warehouse' })}` },
      payload,
    })

    expect(prismaMock.tx.product.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.tx.product.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'prod-A' }, data: { stock: { increment: 5 }, costPrice: 1000 },
    })
    expect(prismaMock.tx.product.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'prod-B' }, data: { stock: { increment: 20 }, costPrice: 500 },
    })
  })

  it('posts an açık hesap (account) purchase to the SUPPLIER ledger with a NEGATIVE amount, decrementing balance', async () => {
    const payload = validPurchasePayload({
      supplierId: 'supplier-1',
      payments: [{ method: 'account', amount: 150000 }],
    })
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'supplier-1', balance: -50000, paymentTermDays: 30 })

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: 'supplier-1',
          type: 'purchase',
          amount: -150000,       // NEGATIVE — we now owe them more
          openAmount: 150000,    // magnitude, per AccountTransaction's documented convention
          referencePurchaseId: 'purchase-db-id-1',
        }),
      }),
    )
    expect(prismaMock.tx.account.update).toHaveBeenCalledWith({
      where: { id: 'supplier-1' },
      data: { balance: { decrement: 150000 } },  // decrement, not increment — this is the
                                                   // exact opposite of sales.ts's veresiye posting
    })
    // No cash payment on this purchase -> register untouched.
    expect(prismaMock.tx.cashMovement.create).not.toHaveBeenCalled()
  })

  it('sets a null dueDate when the supplier has paymentTermDays = 0', async () => {
    const payload = validPurchasePayload({ supplierId: 'supplier-2', payments: [{ method: 'account', amount: 150000 }] })
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'supplier-2', balance: 0, paymentTermDays: 0 })

    await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dueDate: null }) }),
    )
  })

  it('rejects an account payment with no supplierId (400), and never opens a transaction', async () => {
    const payload = validPurchasePayload({ payments: [{ method: 'account', amount: 150000 }] }) // no supplierId

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an account payment referencing a non-existent supplier (400), rolling back the transaction', async () => {
    const payload = validPurchasePayload({ supplierId: 'ghost-supplier', payments: [{ method: 'account', amount: 150000 }] })
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('ValidationError')
  })

  it('returns 500 when a cash purchase is made but the default cash register has not been seeded', async () => {
    const payload = validPurchasePayload()
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(500)
  })

  it('maps a Prisma P2025 (missing product FK) to 400 ValidationError', async () => {
    const payload = validPurchasePayload()
    prismaMock.prisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Record to update not found.'), { code: 'P2025' }),
    )

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
  })

  it('allows a "Firmasız" (no supplier) purchase paid by card, with no ledger or register side effects', async () => {
    const payload = validPurchasePayload({ supplierId: null, payments: [{ method: 'card', amount: 150000 }] })
    prismaMock.tx.purchase.create.mockResolvedValue(fakePurchaseRow(payload))

    const res = await app.inject({
      method: 'POST', url: '/api/purchases',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(prismaMock.tx.accountTransaction.create).not.toHaveBeenCalled()
    expect(prismaMock.tx.cashMovement.create).not.toHaveBeenCalled()
  })
})

describe('GET /api/purchases', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { purchasesRoutes } = await import('./purchases')
    app = await buildTestApp(purchasesRoutes, '/api/purchases')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('lists purchases, optionally filtered by supplierId', async () => {
    const payload = validPurchasePayload({ supplierId: 'supplier-1' })
    prismaMock.prisma.purchase.findMany.mockResolvedValue([fakePurchaseRow(payload)])

    const res = await app.inject({
      method: 'GET', url: '/api/purchases?supplierId=supplier-1',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
    })

    expect(res.statusCode).toBe(200)
    expect(prismaMock.prisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supplierId: 'supplier-1' } }),
    )
    expect(res.json()).toHaveLength(1)
  })

  it('returns 404 for a purchase id that does not exist', async () => {
    prismaMock.prisma.purchase.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET', url: '/api/purchases/does-not-exist',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
