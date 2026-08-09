// server/src/routes/purchases.ts
// ─────────────────────────────────────────────────────────────
// Implements POST /api/purchases (create) and GET /api/purchases
// (list/detail) — the "Alış Faturası" (purchase invoice) flow.
//
// This is Sale's mirror image, not a copy: stock INCREASES per line,
// and an 'account' payment posts to the SUPPLIER's ledger as a
// `purchase` transaction with a NEGATIVE amount — Account.balance is
// always "what this counterparty owes us, net", so a supplier billing
// us makes that MORE negative (we owe them more), not more positive.
// See schema.prisma's TransactionType.purchase comment for the full
// rationale, and CHECKLIST.md for why this is a deliberately separate
// code path from accounts.ts's /payment endpoint (which is currently
// hardcoded for the customer direction only — a known, deferred bug).
//
// Unlike sales.ts, there is no localId/idempotency handling: purchase
// invoices are entered online-only at a desk (no offline queue), so
// there's no retry-after-a-dropped-response scenario to guard against.
//
// Stock increment AND the supplier-ledger/cash-register posting all
// run inside the same $transaction as the purchase insert — same
// atomicity guarantee as sales.ts, see its top-of-file comment.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '../db/prisma'
import { purchaseSchema } from '../schemas/purchase'
import { toDomainPurchase } from '../mappers/purchaseMapper'

const purchaseInclude = { lines: true, payments: true } satisfies Prisma.PurchaseInclude

// Same well-known register cash sales use (routes/sales.ts) — a
// cash-paid purchase pays OUT of the same drawer a cash sale pays INTO.
const DEFAULT_CASH_REGISTER_ID = 'default-cash-register'

class MissingSupplierForAccountPaymentError extends Error {
  constructor() {
    super("Purchase has an 'account' payment line but no supplierId was set.")
    this.name = 'MissingSupplierForAccountPaymentError'
  }
}

class SupplierNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account "${accountId}" does not exist.`)
    this.name = 'SupplierNotFoundError'
  }
}

class DefaultCashRegisterMissingError extends Error {
  constructor() {
    super(`Default cash register ("${DEFAULT_CASH_REGISTER_ID}") does not exist — run the seed script.`)
    this.name = 'DefaultCashRegisterMissingError'
  }
}

async function createPurchase(input: ReturnType<typeof purchaseSchema.parse>, userId: string) {
  const accountPayments = input.payments.filter(p => p.method === 'account')
  if (accountPayments.length > 0 && !input.supplierId) {
    throw new MissingSupplierForAccountPaymentError()
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const purchase = await tx.purchase.create({
      data: {
        invoiceNumber: input.invoiceNumber,
        supplierId: input.supplierId ?? null,
        warehouseId: input.warehouseId,
        userId,

        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        taxTotal: input.taxTotal,
        grandTotal: input.grandTotal,
        invoiceDate: new Date(input.invoiceDate),

        lines: {
          create: input.lines.map(line => ({
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitCost: line.unitCost,
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
      include: purchaseInclude,
    })

    // Increment stock AND refresh the product's cost price for every
    // line, atomically with the purchase insert. If any product
    // doesn't exist, Prisma throws (P2025) and the whole transaction
    // — purchase included — rolls back.
    for (const line of input.lines) {
      await tx.product.update({
        where: { id: line.productId },
        data: {
          stock: { increment: line.quantity },
          // Latest purchase price becomes the product's new reference
          // cost price — matches the mockup's "Alış fiyatı değişikliğini
          // kontrol et" intent (the UI warns the user before saving if
          // this would change; the server just applies it here).
          costPrice: line.unitCost,
        },
      })
    }

    // Post 'account' (açık hesap / vadeli) payment lines to the
    // supplier's ledger, atomically with the purchase.
    for (const payment of accountPayments) {
      const supplierId = input.supplierId!

      const account = await tx.account.findUnique({ where: { id: supplierId } })
      if (!account) {
        throw new SupplierNotFoundError(supplierId)
      }

      const dueDate = account.paymentTermDays > 0
        ? new Date(Date.now() + account.paymentTermDays * 24 * 60 * 60 * 1000)
        : null

      await tx.accountTransaction.create({
        data: {
          accountId: supplierId,
          type: 'purchase',
          amount: -payment.amount,     // decreases balance — we now owe them more
          openAmount: payment.amount,  // magnitude, per AccountTransaction's documented convention
          referencePurchaseId: purchase.id,
          description: `Alış Faturası #${purchase.invoiceNumber ?? purchase.id.slice(0, 8).toUpperCase()}`,
          dueDate,
        },
      })

      await tx.account.update({
        where: { id: supplierId },
        data: { balance: { decrement: payment.amount } },
      })
    }

    // Post 'cash' payment lines as money OUT of the default register,
    // atomically with the purchase.
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
            type: 'out',
            amount: payment.amount,
            referencePurchaseId: purchase.id,
            description: `Alış Faturası #${purchase.invoiceNumber ?? purchase.id.slice(0, 8).toUpperCase()}`,
          },
        })

        await tx.cashRegister.update({
          where: { id: DEFAULT_CASH_REGISTER_ID },
          data: { balance: { decrement: payment.amount } },
        })
      }
    }

    return purchase
  })
}

const listQuerySchema = z.object({
  supplierId: z.string().optional(),
})

export const purchasesRoutes: FastifyPluginAsync = async (app) => {
  const PURCHASE_CREATOR_ROLES = ['admin', 'accountant', 'warehouse']

  // ── GET /api/purchases — list ──
  app.get('/', { preHandler: [app.authenticate, app.requireRole(...PURCHASE_CREATOR_ROLES)] }, async (req, reply) => {
    const queryResult = listQuerySchema.safeParse(req.query)
    if (!queryResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: queryResult.error.issues })
    }

    const rows = await prisma.purchase.findMany({
      where: queryResult.data.supplierId ? { supplierId: queryResult.data.supplierId } : {},
      include: purchaseInclude,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows.map(toDomainPurchase))
  })

  // ── GET /api/purchases/:id — detail ──
  app.get('/:id', { preHandler: [app.authenticate, app.requireRole(...PURCHASE_CREATOR_ROLES)] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = await prisma.purchase.findUnique({ where: { id }, include: purchaseInclude })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Purchase "${id}" does not exist.` })
    }
    return reply.send(toDomainPurchase(row))
  })

  // ── POST /api/purchases — create ──
  app.post('/', { preHandler: [app.authenticate, app.requireRole(...PURCHASE_CREATOR_ROLES)] }, async (req, reply) => {
    const parseResult = purchaseSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    try {
      const row = await createPurchase(parseResult.data, req.user!.userId)
      return reply.code(201).send(toDomainPurchase(row))
    } catch (err) {
      if (err instanceof MissingSupplierForAccountPaymentError || err instanceof SupplierNotFoundError) {
        return reply.code(400).send({ error: 'ValidationError', message: err.message })
      }
      if (err instanceof DefaultCashRegisterMissingError) {
        return reply.code(500).send({ error: 'InternalError', message: err.message })
      }
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(400).send({
          error: 'ValidationError',
          message: 'Purchase references a product or account that does not exist.',
        })
      }
      app.log.error(err, 'Failed to persist purchase')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not save purchase.' })
    }
  })
}
