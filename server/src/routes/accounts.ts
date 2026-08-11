// server/src/routes/accounts.ts
// ─────────────────────────────────────────────────────────────
// GET /api/accounts/:id/balance — called by
// packages/core/src/services/AccountBalanceService.ts.
//
// Architecture rule: §7 OFFLINE MODE — this endpoint is ONLY ever
// reachable when the client is online (AccountBalanceService throws
// OfflineBalanceError before it even attempts the request). There is
// no offline fallback here by design: a stale balance could let a
// cashier authorize a sale beyond the real credit limit.
//
// The rest of this file (list/create/detail/transactions) is Cari
// Hesap Phase 1 — see CHECKLIST.md for the phase breakdown. These
// endpoints ARE safe to cache/read offline in principle (unlike the
// live balance check above), but packages/core doesn't wire that up
// yet; that's part of building the actual Cari Hesap UI screen.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '../db/prisma'
import { createAccountSchema, listAccountsQuerySchema } from '../schemas/account'
import { recordPaymentSchema } from '../schemas/payment'
import { toDomainAccount, toDomainAccountTransaction } from '../mappers/accountMapper'

const paramsSchema = z.object({
  id: z.string().min(1),
})

class AccountNotFoundError extends Error {
  constructor(accountId: string) {
    super(`Account "${accountId}" does not exist.`)
    this.name = 'AccountNotFoundError'
  }
}

/** Thrown when an explicit match references an invoice that doesn't belong
 *  to this account, isn't actually an invoice, or doesn't exist. */
class InvalidMatchError extends Error {
  constructor(invoiceTransactionId: string) {
    super(`"${invoiceTransactionId}" is not an open invoice on this account.`)
    this.name = 'InvalidMatchError'
  }
}

/** Thrown when an explicit match tries to apply more than an invoice's remaining open amount. */
class OverMatchError extends Error {
  constructor(invoiceTransactionId: string) {
    super(`Match amount exceeds the remaining open amount on invoice "${invoiceTransactionId}".`)
    this.name = 'OverMatchError'
  }
}

export const accountsRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/accounts/:id/balance — live balance check (unchanged) ──
  app.get('/:id/balance', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { id } = parseResult.data
    const account = await prisma.account.findUnique({ where: { id } })

    if (!account) {
      return reply.code(404).send({
        error: 'NotFound',
        message: `Account "${id}" does not exist.`,
      })
    }

    return reply.send({
      accountId: account.id,
      balance: account.balance,
      asOf: new Date().toISOString(),
    })
  })

  // ── GET /api/accounts/risk — accounts over their credit limit (Phase 3) ──
  // Registered before the parametric routes below for readability; Fastify's
  // router (find-my-way) always prefers a static path segment over a
  // parametric one, so `/risk` never gets swallowed by `/:id` regardless of
  // registration order — this ordering is just for humans reading the file.
  app.get('/risk', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (_req, reply) => {
    const accounts = await prisma.account.findMany({
      where: { creditLimit: { gt: 0 } },
      orderBy: { balance: 'desc' },
    })
    const overLimit: typeof accounts = []
    for (const a of accounts) {
      if (a.balance > a.creditLimit) overLimit.push(a)
    }
    return reply.send(overLimit.map(toDomainAccount))
  })

  // ── GET /api/accounts — list (optionally filtered by type) ──
  app.get('/', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = listAccountsQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const rows = await prisma.account.findMany({
      where: parseResult.data.type ? { type: parseResult.data.type } : undefined,
      orderBy: { name: 'asc' },
    })
    return reply.send(rows.map(toDomainAccount))
  })

  // ── POST /api/accounts — create a customer/supplier card ──
  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = createAccountSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const row = await prisma.account.create({ data: parseResult.data })
    return reply.code(201).send(toDomainAccount(row))
  })

  // ── GET /api/accounts/:id — full card detail ──
  app.get('/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const row = await prisma.account.findUnique({ where: { id: parseResult.data.id } })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Account "${parseResult.data.id}" does not exist.` })
    }
    return reply.send(toDomainAccount(row))
  })

  // ── GET /api/accounts/:id/transactions — ledger (hareket geçmişi) ──
  app.get('/:id/transactions', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant', 'cashier')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { id } = parseResult.data

    const account = await prisma.account.findUnique({ where: { id } })
    if (!account) {
      return reply.code(404).send({ error: 'NotFound', message: `Account "${id}" does not exist.` })
    }

    const rows = await prisma.accountTransaction.findMany({
      where: { accountId: id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows.map(toDomainAccountTransaction))
  })

  // ── POST /api/accounts/:id/payments — record a payment (Cari Hesap Phase 2) ──
  // Reduces the account's balance and, per open-item accounting practice,
  // matches the payment against specific invoices rather than just treating
  // balance as a single floating number. Two modes:
  //   • `matches` provided  → caller explicitly picks which invoice(s) to pay down
  //   • `matches` omitted   → server auto-matches oldest-open-invoice-first (FIFO)
  app.post('/:id/payments', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant', 'cashier')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = recordPaymentSchema.safeParse(req.body)

    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: accountId } = paramsResult.data
    const { amount, description, matches } = bodyResult.data

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const account = await tx.account.findUnique({ where: { id: accountId } })
        if (!account) throw new AccountNotFoundError(accountId)

        // Account.balance is always "what this counterparty owes us, net" —
        // positive for customer/employee/other (they owe us), but negative
        // for a supplier (we owe THEM — see schema.prisma's
        // TransactionType.purchase comment). Paying a bill therefore moves
        // the balance in opposite directions depending on which side of
        // the counter this account is on:
        //   • customer/employee/other: balance decrements toward zero
        //     from above, and matches against open 'invoice' transactions.
        //   • supplier: balance increments toward zero from below, and
        //     matches against open 'purchase' transactions instead.
        const isSupplier = account.type === 'supplier'
        const matchType = isSupplier ? 'purchase' : 'invoice'

        const paymentTx = await tx.accountTransaction.create({
          data: {
            accountId,
            type: 'payment',
            amount: isSupplier ? amount : -amount,
            openAmount: amount,    // starts fully unmatched/unapplied
            description,
          },
        })

        let remaining = amount

        if (matches && matches.length > 0) {
          // ── Explicit matching ──
          for (const m of matches) {
            const invoice = await tx.accountTransaction.findUnique({ where: { id: m.invoiceTransactionId } })
            if (!invoice || invoice.accountId !== accountId || invoice.type !== matchType) {
              throw new InvalidMatchError(m.invoiceTransactionId)
            }
            if (invoice.openAmount < m.amount) {
              throw new OverMatchError(m.invoiceTransactionId)
            }

            await tx.accountTransactionMatch.create({
              data: { paymentTransactionId: paymentTx.id, invoiceTransactionId: invoice.id, matchedAmount: m.amount },
            })
            await tx.accountTransaction.update({
              where: { id: invoice.id },
              data: { openAmount: { decrement: m.amount } },
            })
            remaining -= m.amount
          }
        } else {
          // ── Auto-match, oldest open invoice/purchase first ──
          const openInvoices = await tx.accountTransaction.findMany({
            where: { accountId, type: matchType, openAmount: { gt: 0 } },
            orderBy: { createdAt: 'asc' },
          })

          for (const invoice of openInvoices) {
            if (remaining <= 0) break
            const matchAmount = Math.min(invoice.openAmount, remaining)

            await tx.accountTransactionMatch.create({
              data: { paymentTransactionId: paymentTx.id, invoiceTransactionId: invoice.id, matchedAmount: matchAmount },
            })
            await tx.accountTransaction.update({
              where: { id: invoice.id },
              data: { openAmount: { decrement: matchAmount } },
            })
            remaining -= matchAmount
          }
        }

        // Whatever wasn't matched to an invoice/purchase stays as the
        // payment's own open amount (e.g. customer overpaid, or had no
        // open invoices yet).
        await tx.accountTransaction.update({
          where: { id: paymentTx.id },
          data: { openAmount: remaining },
        })

        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: { balance: isSupplier ? { increment: amount } : { decrement: amount } },
        })

        return {
          transactionId: paymentTx.id,
          matchedAmount: amount - remaining,
          unmatchedAmount: remaining,
          account: updatedAccount,
        }
      })

      return reply.code(201).send({
        transactionId: result.transactionId,
        matchedAmount: result.matchedAmount,
        unmatchedAmount: result.unmatchedAmount,
        account: toDomainAccount(result.account),
      })
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      if (err instanceof InvalidMatchError || err instanceof OverMatchError) {
        return reply.code(400).send({ error: 'ValidationError', message: err.message })
      }
      app.log.error(err, 'Failed to record payment')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not record payment.' })
    }
  })

  // ── GET /api/accounts/:id/aging — vade bazlı açık bakiye dağılımı (Phase 3) ──
  // Buckets every still-open invoice by how many days past its due date it
  // is. Invoices with no due date, or a due date still in the future, land
  // in `current` (not yet due — not a risk signal by themselves).
  app.get('/:id/aging', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { id } = parseResult.data
    const account = await prisma.account.findUnique({ where: { id } })
    if (!account) {
      return reply.code(404).send({ error: 'NotFound', message: `Account "${id}" does not exist.` })
    }

    const openInvoices = await prisma.accountTransaction.findMany({
      where: { accountId: id, type: 'invoice', openAmount: { gt: 0 } },
    })

    const now = Date.now()
    const buckets = { current: 0, days0to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }

    for (const invoice of openInvoices) {
      if (!invoice.dueDate || invoice.dueDate.getTime() > now) {
        buckets.current += invoice.openAmount
        continue
      }

      const daysOverdue = Math.floor((now - invoice.dueDate.getTime()) / (24 * 60 * 60 * 1000))
      if (daysOverdue <= 30) buckets.days0to30 += invoice.openAmount
      else if (daysOverdue <= 60) buckets.days31to60 += invoice.openAmount
      else if (daysOverdue <= 90) buckets.days61to90 += invoice.openAmount
      else buckets.days90plus += invoice.openAmount
    }

    const totalOpen = Object.values(buckets).reduce((sum, v) => sum + v, 0)

    return reply.send({
      accountId: id,
      asOf: new Date().toISOString(),
      totalOpen,
      buckets,
    })
  })

  // ── POST /api/accounts/:id/interest — gecikme faizi uygula (Phase 3) ──
  // Applies a flat rate to the TOTAL currently-overdue open amount (not a
  // compounding daily schedule — that's more precision than a first pass
  // needs) and posts it as a new 'interest' ledger transaction, atomically
  // with the account balance update.
  app.post('/:id/interest', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = z.object({ rate: z.number().min(0).max(1) }).safeParse(req.body)

    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: accountId } = paramsResult.data
    const { rate } = bodyResult.data

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const account = await tx.account.findUnique({ where: { id: accountId } })
        if (!account) throw new AccountNotFoundError(accountId)

        const now = new Date()
        const overdueInvoices = await tx.accountTransaction.findMany({
          where: { accountId, type: 'invoice', openAmount: { gt: 0 }, dueDate: { lt: now } },
        })

        let totalOverdueOpen = 0
        for (const inv of overdueInvoices) {
          totalOverdueOpen += inv.openAmount
        }
        if (totalOverdueOpen === 0) {
          return { interestAmount: 0, account }
        }

        const interestAmount = Math.round(totalOverdueOpen * rate)

        await tx.accountTransaction.create({
          data: {
            accountId,
            type: 'interest',
            amount: interestAmount,
            openAmount: interestAmount,
            description: `Gecikme faizi (%${(rate * 100).toFixed(2)})`,
          },
        })

        const updatedAccount = await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: interestAmount } },
        })

        return { interestAmount, account: updatedAccount }
      })

      return reply.send({
        accountId,
        interestAmount: result.interestAmount,
        account: toDomainAccount(result.account),
      })
    } catch (err) {
      if (err instanceof AccountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      app.log.error(err, 'Failed to apply interest')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not apply interest.' })
    }
  })
}
