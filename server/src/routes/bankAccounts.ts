// server/src/routes/bankAccounts.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/bank-accounts                     — list
// POST /api/bank-accounts                     — create
// GET  /api/bank-accounts/:id                 — detail
// POST /api/bank-accounts/:id/transactions    — manual entry
// GET  /api/bank-accounts/:id/transactions    — transaction history
//
// Phase 4-5 scope (CSV/OFX statement import, auto-reconciliation) is
// NOT implemented — this is manual entry only, per the Phase 1-3 plan.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '../db/prisma'
import { createBankAccountSchema, recordBankTransactionSchema } from '../schemas/finance'
import { toDomainBankAccount, toDomainBankTransaction } from '../mappers/financeMapper'

const paramsSchema = z.object({ id: z.string().min(1) })

class BankAccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Bank account "${id}" does not exist.`)
    this.name = 'BankAccountNotFoundError'
  }
}

export const bankAccountsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (_req, reply) => {
    const rows = await prisma.bankAccount.findMany({ orderBy: { name: 'asc' } })
    return reply.send(rows.map(toDomainBankAccount))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = createBankAccountSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const row = await prisma.bankAccount.create({ data: parseResult.data })
    return reply.code(201).send(toDomainBankAccount(row))
  })

  app.get('/:id', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const row = await prisma.bankAccount.findUnique({ where: { id: parseResult.data.id } })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Bank account "${parseResult.data.id}" does not exist.` })
    }
    return reply.send(toDomainBankAccount(row))
  })

  app.post('/:id/transactions', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = recordBankTransactionSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: bankAccountId } = paramsResult.data
    const { type, amount, categoryId, description } = bodyResult.data

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const account = await tx.bankAccount.findUnique({ where: { id: bankAccountId } })
        if (!account) throw new BankAccountNotFoundError(bankAccountId)

        const transaction = await tx.bankTransaction.create({
          data: { bankAccountId, type, amount, categoryId, description },
        })

        const updatedAccount = await tx.bankAccount.update({
          where: { id: bankAccountId },
          data: { balance: type === 'deposit' ? { increment: amount } : { decrement: amount } },
        })

        return { transaction, account: updatedAccount }
      })

      return reply.code(201).send({
        transaction: toDomainBankTransaction(result.transaction),
        account: toDomainBankAccount(result.account),
      })
    } catch (err) {
      if (err instanceof BankAccountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      app.log.error(err, 'Failed to record bank transaction')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not record transaction.' })
    }
  })

  app.get('/:id/transactions', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const rows = await prisma.bankTransaction.findMany({
      where: { bankAccountId: parseResult.data.id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows.map(toDomainBankTransaction))
  })
}
