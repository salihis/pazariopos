// server/src/routes/sales.ts
// ─────────────────────────────────────────────────────────────
// Implements the two endpoints packages/core/src/api/salesApi.ts
// calls:
//   POST /api/sales       — online branch of useSaleStore.submitSale()
//   POST /api/sales/sync  — sync engine pushing a queued offline sale
//
// Both endpoints are intentionally idempotent on `localId`: the
// device generates that UUID once, before it knows whether it will
// go straight to the API or sit in the offline queue for a while.
// If the same localId arrives twice (e.g. a retried sync after a
// dropped response), we return the existing row instead of erroring
// or double-inserting — and critically, WITHOUT decrementing stock or
// posting to the account a second time. See ARCHITECTURE.md §4a.
//
// Stock decrement AND account-ledger posting both run inside the same
// Prisma transaction as the sale insert: a sale can never be persisted
// without its stock effect and its "veresiye" (account/tab) effect
// landing too. MVP does not block oversold lines or over-limit account
// sales — that validation is Cari Hesap Phase 3 (risk/aging), tracked
// in CHECKLIST.md.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '../db/prisma'
import { saleSchema } from '../schemas/sale'
import { toDomainSale } from '../mappers/saleMapper'
// Deliberately from '@pazariopos/core/constants', NOT the root
// '@pazariopos/core' barrel — see saleMapper.ts's comment on the
// same restriction (the root barrel re-exports browser-facing classes
// that don't typecheck without a DOM lib, which the server's tsconfig
// doesn't have).
import { MISC_SALE_PRODUCT_ID } from '@pazariopos/core/constants'

const saleInclude = { lines: true, payments: true } satisfies Prisma.SaleInclude

// Cash sales post to this well-known register (seeded in prisma/seed.ts),
// mirroring the "single implicit warehouse" pattern used by Inventory MVP —
// see ARCHITECTURE.md's Inventory prompt for the same simplification there.
const DEFAULT_CASH_REGISTER_ID = 'default-cash-register'

/** Thrown when a sale has an 'account' payment line but no customerId. */
class MissingCustomerForAccountPaymentError extends Error {
  constructor() {
    super("Sale has an 'account' payment line but no customerId was set.")
    this.name = 'MissingCustomerForAccountPaymentError'
  }
}

/** Thrown when a sale's customerId doesn't match any existing account. */
class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account "${accountId}" does not exist.`)
    this.name = 'AccountNotFoundError'
  }
}

/** Thrown when a cash sale is made but the default cash register hasn't been seeded. */
class DefaultCashRegisterMissingError extends Error {
  constructor() {
    super(`Default cash register ("${DEFAULT_CASH_REGISTER_ID}") does not exist — run the seed script.`)
    this.name = 'DefaultCashRegisterMissingError'
  }
}

async function upsertSaleByLocalId(input: ReturnType<typeof saleSchema.parse>) {
  const existing = await prisma.sale.findUnique({
    where: { localId: input.localId },
    include: saleInclude,
  })

  if (existing) {
    // Idempotent replay — the device already got this persisted (stock and
    // account effects already applied) once. Do NOT apply either again.
    return existing
  }

  const accountPayments = input.payments.filter(p => p.method === 'account')
  if (accountPayments.length > 0 && !input.customerId) {
    throw new MissingCustomerForAccountPaymentError()
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.create({
      data: {
        localId: input.localId,
        branchId: input.branchId,
        registerId: input.registerId,
        cashierId: input.cashierId,
        customerId: input.customerId,

        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        taxTotal: input.taxTotal,
        grandTotal: input.grandTotal,
        changeGiven: input.changeGiven,

        status: input.status,
        deviceId: input.deviceId,
        syncStatus: 'synced',   // once it lands here, it IS synced
        syncedAt: new Date(),

        lines: {
          create: input.lines.map(line => ({
            productId: line.product.id,
            productName: line.product.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountAmount: line.discountAmount,
            taxAmount: line.taxAmount,
            total: line.total,
          })),
        },
        payments: {
          create: input.payments.map(payment => ({
            method: payment.method,
            amount: payment.amount,
            reference: payment.reference,
          })),
        },
      },
      include: saleInclude,
    })

    // Decrement stock for every line, atomically with the sale insert.
    // If any product doesn't exist, Prisma throws (P2025) and the whole
    // transaction — sale included — rolls back, rather than saving a
    // sale that references inventory that was never actually reduced.
    // Exception: MISC_SALE_PRODUCT_ID ("Muhtelif Satış") is a sentinel,
    // not a real catalog row — it's never inventory-tracked, so there's
    // nothing to decrement.
    for (const line of input.lines) {
      if (line.product.id === MISC_SALE_PRODUCT_ID) continue
      await tx.product.update({
        where: { id: line.product.id },
        data: { stock: { decrement: line.quantity } },
      })
    }

    // Post 'account' (veresiye) payment lines to the customer's ledger,
    // atomically with the sale. Cari Hesap Phase 1 — see schema.prisma's
    // Account/AccountTransaction models.
    for (const payment of accountPayments) {
      // input.customerId is guaranteed non-null here (checked above,
      // before the transaction even opened).
      const customerId = input.customerId!

      const account = await tx.account.findUnique({ where: { id: customerId } })
      if (!account) {
        throw new AccountNotFoundError(customerId)
      }

      const dueDate = account.paymentTermDays > 0
        ? new Date(Date.now() + account.paymentTermDays * 24 * 60 * 60 * 1000)
        : null

      await tx.accountTransaction.create({
        data: {
          accountId: customerId,
          type: 'invoice',
          amount: payment.amount,
          openAmount: payment.amount,
          referenceSaleId: sale.id,
          description: `Satış #${sale.localId.slice(0, 8).toUpperCase()}`,
          dueDate,
        },
      })

      await tx.account.update({
        where: { id: customerId },
        data: { balance: { increment: payment.amount } },
      })
    }

    // Post 'cash' payment lines to the default cash register, atomically
    // with the sale. Gelir/Gider & Finans Phase 1 — see schema.prisma's
    // CashRegister/CashMovement models. Manual (non-sale) cash movements
    // go through routes/cashRegisters.ts instead.
    const cashPayments = input.payments.filter(p => p.method === 'cash')
    if (cashPayments.length > 0) {
      const register = await tx.cashRegister.findUnique({ where: { id: DEFAULT_CASH_REGISTER_ID } })
      if (!register) {
        throw new DefaultCashRegisterMissingError()
      }

      for (const payment of cashPayments) {
        await tx.cashMovement.create({
          data: {
            cashRegisterId: DEFAULT_CASH_REGISTER_ID,
            type: 'in',
            amount: payment.amount,
            referenceSaleId: sale.id,
            description: `Satış #${sale.localId.slice(0, 8).toUpperCase()}`,
          },
        })

        await tx.cashRegister.update({
          where: { id: DEFAULT_CASH_REGISTER_ID },
          data: { balance: { increment: payment.amount } },
        })
      }
    }

    return sale
  })
}

export const salesRoutes: FastifyPluginAsync = async (app) => {
  const SALE_CREATOR_ROLES = ['admin', 'accountant', 'cashier', 'warehouse']

  // ── GET /api/sales — list, for the "Satış Fatura Listesi" back-office
  // screen. Filterable by date range, customer, and cashier; capped at
  // 500 rows (this is a browsing/reporting list, not a full export —
  // see reportsApi for aggregate figures over larger ranges). ──
  const listQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    customerId: z.string().optional(),
    cashierId: z.string().optional(),
  })

  app.get('/', { preHandler: [app.authenticate, app.requireRole(...SALE_CREATOR_ROLES)] }, async (req, reply) => {
    const queryResult = listQuerySchema.safeParse(req.query)
    if (!queryResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: queryResult.error.issues })
    }
    const { from, to, customerId, cashierId } = queryResult.data

    const rows = await prisma.sale.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(cashierId ? { cashierId } : {}),
        ...(from || to
          ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    return reply.send(rows.map(toDomainSale))
  })

  // ── GET /api/sales/:id — detail (receipt-style view) ──
  app.get('/:id', { preHandler: [app.authenticate, app.requireRole(...SALE_CREATOR_ROLES)] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = await prisma.sale.findUnique({ where: { id }, include: saleInclude })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Sale "${id}" does not exist.` })
    }
    return reply.send(toDomainSale(row))
  })

  // ── POST /api/sales — direct online submission ──

  app.post('/', { preHandler: [app.authenticate, app.requireRole(...SALE_CREATOR_ROLES)] }, async (req, reply) => {
    const parseResult = saleSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: parseResult.error.issues,
      })
    }

    try {
      const row = await upsertSaleByLocalId(parseResult.data)
      return reply.code(201).send(toDomainSale(row))
    } catch (err) {
      if (err instanceof MissingCustomerForAccountPaymentError || err instanceof AccountNotFoundError) {
        return reply.code(400).send({ error: 'ValidationError', message: err.message })
      }
      if (err instanceof DefaultCashRegisterMissingError) {
        return reply.code(500).send({ error: 'InternalError', message: err.message })
      }
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(400).send({
          error: 'ValidationError',
          message: 'Sale references a product or account that does not exist.',
        })
      }
      app.log.error(err, 'Failed to persist sale')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not save sale.' })
    }
  })

  // ── POST /api/sales/sync — pushed from the desktop offline queue ──
  app.post('/sync', { preHandler: [app.authenticate, app.requireRole(...SALE_CREATOR_ROLES)] }, async (req, reply) => {
    const parseResult = saleSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: parseResult.error.issues,
      })
    }

    try {
      const row = await upsertSaleByLocalId(parseResult.data)
      return reply.code(200).send(toDomainSale(row))
    } catch (err) {
      if (err instanceof MissingCustomerForAccountPaymentError || err instanceof AccountNotFoundError) {
        return reply.code(400).send({ error: 'ValidationError', message: err.message })
      }
      if (err instanceof DefaultCashRegisterMissingError) {
        return reply.code(500).send({ error: 'InternalError', message: err.message })
      }
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(400).send({
          error: 'ValidationError',
          message: 'Sale references a product or account that does not exist.',
        })
      }
      app.log.error(err, 'Failed to sync sale')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not sync sale.' })
    }
  })
}
