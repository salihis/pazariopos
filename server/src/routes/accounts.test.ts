// server/src/routes/accounts.test.ts
// ─────────────────────────────────────────────────────────────
// Focused on POST /api/accounts/:id/payments — specifically the
// customer-vs-supplier DIRECTION bug fix. Account.balance is always
// "what this counterparty owes us, net": positive for
// customer/employee/other (they owe us), negative for a supplier (we
// owe them). Paying down a balance therefore moves it in OPPOSITE
// directions depending on account.type — this suite exists because
// that exact bug shipped silently (no test caught it; a user
// screenshot did) and must never regress.
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

function fakeAccountRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'acc-1', name: 'Test Account', type: 'customer',
    taxNumber: null, address: null, phone: null, email: null, ibanList: [],
    creditLimit: 0, paymentTermDays: 0, discountRate: 0, balance: 0,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/accounts/:id/payments', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { accountsRoutes } = await import('./accounts')
    app = await buildTestApp(accountsRoutes, '/api/accounts')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('rejects requests with no Authorization header (401)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/accounts/acc-1/payments', payload: { amount: 1000 } })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for a non-existent account', async () => {
    prismaMock.tx.account.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/accounts/ghost/payments',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { amount: 1000 },
    })

    expect(res.statusCode).toBe(404)
  })

  describe('customer account (tahsilat — collecting what they owe us)', () => {
    it('posts a NEGATIVE transaction amount and DECREMENTS the balance', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'cust-1', type: 'customer', balance: 15000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      prismaMock.tx.account.update.mockResolvedValue(fakeAccountRow({ id: 'cust-1', type: 'customer', balance: 5000 }))

      const res = await app.inject({
        method: 'POST', url: '/api/accounts/cust-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 10000 },
      })

      expect(res.statusCode).toBe(201)
      expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'payment', amount: -10000, openAmount: 10000 }) }),
      )
      expect(prismaMock.tx.account.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { balance: { decrement: 10000 } },
      })
    })

    it('auto-matches against open INVOICE transactions, oldest first', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'cust-1', type: 'customer', balance: 10000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      prismaMock.tx.accountTransaction.findMany.mockResolvedValue([
        { id: 'inv-1', openAmount: 6000 },
      ])
      prismaMock.tx.account.update.mockResolvedValue(fakeAccountRow({ id: 'cust-1', type: 'customer', balance: 0 }))

      await app.inject({
        method: 'POST', url: '/api/accounts/cust-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 10000 },
      })

      expect(prismaMock.tx.accountTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ accountId: 'cust-1', type: 'invoice' }) }),
      )
    })
  })

  describe('supplier account (ödeme — paying down what we owe them)', () => {
    it('posts a POSITIVE transaction amount and INCREMENTS the balance (toward zero from negative)', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'sup-1', type: 'supplier', balance: -50000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      prismaMock.tx.account.update.mockResolvedValue(fakeAccountRow({ id: 'sup-1', type: 'supplier', balance: -20000 }))

      const res = await app.inject({
        method: 'POST', url: '/api/accounts/sup-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 30000 },
      })

      expect(res.statusCode).toBe(201)
      // The exact opposite sign from the customer case above — this is
      // the fix. A regression here would silently re-break the bug the
      // user found via screenshot.
      expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'payment', amount: 30000, openAmount: 30000 }) }),
      )
      expect(prismaMock.tx.account.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: { balance: { increment: 30000 } },
      })
    })

    it('auto-matches against open PURCHASE transactions, not invoices', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'sup-1', type: 'supplier', balance: -50000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      prismaMock.tx.accountTransaction.findMany.mockResolvedValue([])
      prismaMock.tx.account.update.mockResolvedValue(fakeAccountRow({ id: 'sup-1', type: 'supplier', balance: -20000 }))

      await app.inject({
        method: 'POST', url: '/api/accounts/sup-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 30000 },
      })

      expect(prismaMock.tx.accountTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ accountId: 'sup-1', type: 'purchase' }) }),
      )
    })

    it('rejects an explicit match against an invoice-type transaction on a supplier account', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'sup-1', type: 'supplier', balance: -50000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      // This transaction is type 'invoice', but the account is a supplier
      // (whose matchable type is 'purchase') — must be rejected.
      prismaMock.tx.accountTransaction.findUnique.mockResolvedValue({
        id: 'inv-1', accountId: 'sup-1', type: 'invoice', openAmount: 30000,
      })

      const res = await app.inject({
        method: 'POST', url: '/api/accounts/sup-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 30000, matches: [{ invoiceTransactionId: 'inv-1', amount: 30000 }] },
      })

      expect(res.statusCode).toBe(400)
    })
  })

  describe('employee/other accounts (unchanged — same direction as customer)', () => {
    it('employee: posts a NEGATIVE amount and DECREMENTS the balance, same as customer', async () => {
      prismaMock.tx.account.findUnique.mockResolvedValue({ id: 'emp-1', type: 'employee', balance: 8000 })
      prismaMock.tx.accountTransaction.create.mockResolvedValue({ id: 'paytx-1' })
      prismaMock.tx.account.update.mockResolvedValue(fakeAccountRow({ id: 'emp-1', type: 'employee', balance: 0 }))

      await app.inject({
        method: 'POST', url: '/api/accounts/emp-1/payments',
        headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
        payload: { amount: 8000 },
      })

      expect(prismaMock.tx.accountTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: -8000 }) }),
      )
      expect(prismaMock.tx.account.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { balance: { decrement: 8000 } },
      })
    })
  })
})
