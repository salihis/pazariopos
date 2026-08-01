// server/src/routes/cashRegisters.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/cash-registers                    — list
// POST /api/cash-registers                    — create
// GET  /api/cash-registers/:id                — detail
// POST /api/cash-registers/:id/movements      — manual kasa hareketi
// GET  /api/cash-registers/:id/movements      — movement history
// POST /api/cash-registers/:id/count          — gün sonu kasa sayımı
// GET  /api/cash-registers/:id/counts         — count history
//
// Note: cash sales from the POS checkout flow post their own
// CashMovement automatically — see routes/sales.ts. Movements
// created here (manual entry) are for anything else: petty cash,
// manual corrections, non-sale cash in/out.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '../db/prisma'
import { createCashRegisterSchema, recordCashMovementSchema, recordCashCountSchema } from '../schemas/finance'
import { toDomainCashRegister, toDomainCashMovement, toDomainCashCount } from '../mappers/financeMapper'

const paramsSchema = z.object({ id: z.string().min(1) })

class CashRegisterNotFoundError extends Error {
  constructor(id: string) {
    super(`Cash register "${id}" does not exist.`)
    this.name = 'CashRegisterNotFoundError'
  }
}

export const cashRegistersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (_req, reply) => {
    const rows = await prisma.cashRegister.findMany({ orderBy: { name: 'asc' } })
    return reply.send(rows.map(toDomainCashRegister))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (req, reply) => {
    const parseResult = createCashRegisterSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const row = await prisma.cashRegister.create({ data: parseResult.data })
    return reply.code(201).send(toDomainCashRegister(row))
  })

  app.get('/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const row = await prisma.cashRegister.findUnique({ where: { id: parseResult.data.id } })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Cash register "${parseResult.data.id}" does not exist.` })
    }
    return reply.send(toDomainCashRegister(row))
  })

  // ── POST /:id/movements — manual cash in/out ──
  app.post('/:id/movements', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant', 'cashier')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = recordCashMovementSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: cashRegisterId } = paramsResult.data
    const { type, amount, categoryId, description } = bodyResult.data

    try {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const register = await tx.cashRegister.findUnique({ where: { id: cashRegisterId } })
        if (!register) throw new CashRegisterNotFoundError(cashRegisterId)

        const movement = await tx.cashMovement.create({
          data: { cashRegisterId, type, amount, categoryId, description },
        })

        const updatedRegister = await tx.cashRegister.update({
          where: { id: cashRegisterId },
          data: { balance: type === 'in' ? { increment: amount } : { decrement: amount } },
        })

        return { movement, register: updatedRegister }
      })

      return reply.code(201).send({
        movement: toDomainCashMovement(result.movement),
        register: toDomainCashRegister(result.register),
      })
    } catch (err) {
      if (err instanceof CashRegisterNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      app.log.error(err, 'Failed to record cash movement')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not record movement.' })
    }
  })

  app.get('/:id/movements', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const rows = await prisma.cashMovement.findMany({
      where: { cashRegisterId: parseResult.data.id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows.map(toDomainCashMovement))
  })

  // ── POST /:id/count — gün sonu kasa sayımı ──
  app.post('/:id/count', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant', 'cashier')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = recordCashCountSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: cashRegisterId } = paramsResult.data
    const { countedAmount, notes } = bodyResult.data

    const register = await prisma.cashRegister.findUnique({ where: { id: cashRegisterId } })
    if (!register) {
      return reply.code(404).send({ error: 'NotFound', message: `Cash register "${cashRegisterId}" does not exist.` })
    }

    const expectedAmount = register.balance
    const difference = countedAmount - expectedAmount

    const count = await prisma.cashCount.create({
      data: { cashRegisterId, expectedAmount, countedAmount, difference, notes },
    })

    return reply.code(201).send(toDomainCashCount(count))
  })

  app.get('/:id/counts', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const rows = await prisma.cashCount.findMany({
      where: { cashRegisterId: parseResult.data.id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows.map(toDomainCashCount))
  })
}
