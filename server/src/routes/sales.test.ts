// server/src/routes/sales.test.ts
// ─────────────────────────────────────────────────────────────
// Exercises routes/sales.ts through real Fastify request/response
// (app.inject), with the Prisma client mocked (see test/prismaMock.ts).
// Covers the invariants the route's own top-of-file comment promises:
//   • Stock decrement + account ledger + cash-register posting all run
//     inside ONE $transaction alongside the sale insert.
//   • Idempotent on `localId` — a replay must NOT re-run any of those
//     side effects.
//   • 'account' payments require a customerId, checked BEFORE the
//     transaction opens (no half-applied side effects).
// A companion real-Postgres suite (sales.route.integration.test.ts)
// covers the same scenarios end-to-end; run that one wherever
// `prisma generate` can reach binaries.prisma.sh (not this sandbox —
// see references/troubleshooting-and-design.md).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { createPrismaMock, type PrismaMock } from '../test/prismaMock'
import { buildTestApp, tokenFor } from '../test/buildTestApp'

let prismaMock: PrismaMock

vi.mock('../db/prisma', () => ({
  get prisma() {
    return prismaMock.prisma
  },
}))

function product(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1',
    sku: 'SKU-1',
    name: 'Ekmek',
    barcode: ['1111'],
    price: 1000,
    taxRate: 0.18,
    stock: 50,
    lowStockThreshold: 5,
    unit: 'piece',
    categoryId: 'cat-1',
    isActive: true, costPrice: null,
    warehouseId: 'wh-1',
    ...overrides,
  }
}

function saleLine(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    product: product(),
    quantity: 2,
    unitPrice: 1000,
    discountAmount: 0,
    taxAmount: 180,
    total: 2360,
    ...overrides,
  }
}

function validSalePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '',
    localId: randomUUID(),
    branchId: 'branch-1',
    registerId: 'register-1',
    cashierId: 'user-1',
    customerId: undefined as string | undefined,
    lines: [saleLine()],
    payments: [{ method: 'cash', amount: 2360 }] as Array<{ method: string; amount: number; reference?: string }>,
    subtotal: 2000,
    discountTotal: 0,
    taxTotal: 360,
    grandTotal: 2360,
    changeGiven: 0,
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

/** The row shape `tx.sale.create` would resolve with, including relations. */
function fakeSaleRow(input: ReturnType<typeof validSalePayload>) {
  return {
    id: 'sale-db-id-1',
    localId: input.localId,
    branchId: input.branchId,
    registerId: input.registerId,
    cashierId: input.cashierId,
    customerId: input.customerId ?? null,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    taxTotal: input.taxTotal,
    grandTotal: input.grandTotal,
    changeGiven: input.changeGiven,
    status: input.status,
    deviceId: null,
    syncStatus: 'synced',
    syncedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: input.lines.map((l: any) => ({
      productId: l.product.id,
      productName: l.product.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      taxAmount: l.taxAmount,
      total: l.total,
    })),
    payments: input.payments.map((p: any) => ({
      method: p.method,
      amount: p.amount,
      reference: p.reference ?? null,
    })),
  }
}

describe('POST /api/sales', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { salesRoutes } = await import('./sales')
    app = await buildTestApp(salesRoutes)
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('rejects requests with no Authorization header (401)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/sales', payload: validSalePayload() })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a role not permitted to create sales (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor({ role: 'viewer' })}` },
      payload: validSalePayload(),
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects a malformed payload with 400 and does not touch the DB', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload: { ...validSalePayload(), lines: [] }, // min(1) violated
    })
    expect(res.statusCode).toBe(400)
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('persists a cash sale, decrements stock per line, and posts to the cash register — all inside one transaction', async () => {
    const payload = validSalePayload()
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null) // no existing localId
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue({ id: 'default-cash-register', balance: 0 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(1)

    // Stock decremented for the one line, by its quantity.
    expect(prismaMock.tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stock: { decrement: 2 } },
    })

    // Cash payment posted to the well-known register and its balance bumped.
    expect(prismaMock.tx.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cashRegisterId: 'default-cash-register',
          type: 'in',
          amount: 2360,
          referenceSaleId: 'sale-db-id-1',
        }),
      }),
    )
    expect(prismaMock.tx.cashRegister.update).toHaveBeenCalledWith({
      where: { id: 'default-cash-register' },
      data: { balance: { increment: 2360 } },
    })

    // Cash-only sale must NOT touch the account ledger.
    expect(prismaMock.tx.account.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.tx.accountTransaction.create).not.toHaveBeenCalled()
  })

  it('decrements stock once per line, with each line\'s own quantity, for multi-line sales', async () => {
    const payload = validSalePayload({
      lines: [
        saleLine({ product: product({ id: 'prod-A' }), quantity: 3 }),
        saleLine({ product: product({ id: 'prod-B' }), quantity: 1 }),
      ],
    })
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue({ id: 'default-cash-register', balance: 0 })

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(prismaMock.tx.product.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.tx.product.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'prod-A' },
      data: { stock: { decrement: 3 } },
    })
    expect(prismaMock.tx.product.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'prod-B' },
      data: { stock: { decrement: 1 } },
    })
  })

  it('posts a veresiye (account) payment to the customer ledger and increments the account balance', async () => {
    const payload = validSalePayload({
      customerId: 'cust-1',
      payments: [{ method: 'account', amount: 2360 }],
    })
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue({
      id: 'cust-1', balance: 0, paymentTermDays: 30,
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: 'cust-1',
          type: 'invoice',
          amount: 2360,
          openAmount: 2360,
          referenceSaleId: 'sale-db-id-1',
        }),
      }),
    )
    expect(prismaMock.tx.account.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { balance: { increment: 2360 } },
    })
    // No cash payment on this sale -> register must be untouched.
    expect(prismaMock.tx.cashMovement.create).not.toHaveBeenCalled()
  })

  it('sets a null dueDate when the account has paymentTermDays = 0 (immediate/no-term account)', async () => {
    const payload = validSalePayload({
      customerId: 'cust-2',
      payments: [{ method: 'account', amount: 2360 }],
    })
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'cust-2', balance: 0, paymentTermDays: 0 })

    await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dueDate: null }) }),
    )
  })

  it('rejects an account payment with no customerId (400), and never opens a transaction', async () => {
    const payload = validSalePayload({ payments: [{ method: 'account', amount: 2360 }] }) // no customerId
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects an account payment referencing a non-existent account (400), rolling back the transaction', async () => {
    const payload = validSalePayload({
      customerId: 'ghost-account',
      payments: [{ method: 'account', amount: 2360 }],
    })
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.account.findUnique.mockResolvedValue(null) // account not found

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('ValidationError')
  })

  it('returns 500 when a cash sale is made but the default cash register has not been seeded', async () => {
    const payload = validSalePayload()
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue(null) // not seeded

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(500)
  })

  it('maps a Prisma P2025 (missing product/account FK) to 400 ValidationError', async () => {
    const payload = validSalePayload()
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.prisma.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Record to update not found.'), { code: 'P2025' }),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(400)
  })

  it('is idempotent on localId: a replay returns the existing sale WITHOUT re-running any side effects', async () => {
    const payload = validSalePayload()
    const existingRow = fakeSaleRow(payload)
    prismaMock.prisma.sale.findUnique.mockResolvedValue(existingRow) // already persisted

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().id).toBe('sale-db-id-1')
    // The whole point of the idempotency check: no transaction opened at all,
    // so stock/ledger/register effects cannot be double-applied on replay.
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe('POST /api/sales/sync', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { salesRoutes } = await import('./sales')
    app = await buildTestApp(salesRoutes)
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('returns 200 (not 201) on successful sync of a queued offline sale', async () => {
    const payload = validSalePayload()
    prismaMock.prisma.sale.findUnique.mockResolvedValue(null)
    prismaMock.tx.sale.create.mockResolvedValue(fakeSaleRow(payload))
    prismaMock.tx.cashRegister.findUnique.mockResolvedValue({ id: 'default-cash-register', balance: 0 })

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales/sync',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(200)
  })

  it('replaying the same localId via /sync after a dropped response is also idempotent', async () => {
    const payload = validSalePayload()
    prismaMock.prisma.sale.findUnique.mockResolvedValue(fakeSaleRow(payload))

    const res = await app.inject({
      method: 'POST',
      url: '/api/sales/sync',
      headers: { authorization: `Bearer ${tokenFor()}` },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled()
  })
})
