// server/src/routes/cheques.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/cheques                — list, filterable by status/type
// POST /api/cheques                — register a new cheque (status: in_wallet)
// GET  /api/cheques/upcoming        — vade takvimi (due within N days)
// GET  /api/cheques/:id            — detail
// POST /api/cheques/:id/status     — status transition (validated)
//
// Status workflow: in_wallet → at_bank → collected/returned/protested.
// Terminal states (collected/returned/protested) have no further
// transitions — see schemas/finance.ts's isAllowedChequeTransition.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { prisma } from '../db/prisma'
import { createChequeSchema, updateChequeStatusSchema, isAllowedChequeTransition } from '../schemas/finance'
import { toDomainCheque } from '../mappers/financeMapper'

const paramsSchema = z.object({ id: z.string().min(1) })

const listQuerySchema = z.object({
  status: z.enum(['in_wallet', 'at_bank', 'collected', 'returned', 'protested']).optional(),
  type: z.enum(['customer_cheque', 'own_cheque']).optional(),
})

const upcomingQuerySchema = z.object({
  days: z.coerce.number().int().positive().default(30),
})

export const chequesRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /upcoming — registered BEFORE /:id so "upcoming" is never
  // swallowed as a param value (Fastify's router prefers static routes
  // regardless of order, but this reads clearer). ──
  app.get('/upcoming', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = upcomingQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const horizon = new Date(Date.now() + parseResult.data.days * 24 * 60 * 60 * 1000)

    const rows = await prisma.cheque.findMany({
      where: {
        status: { in: ['in_wallet', 'at_bank'] },   // only still-pending cheques matter for a due-date calendar
        dueDate: { lte: horizon },
      },
      orderBy: { dueDate: 'asc' },
    })
    return reply.send(rows.map(toDomainCheque))
  })

  app.get('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = listQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const rows = await prisma.cheque.findMany({
      where: {
        status: parseResult.data.status,
        type: parseResult.data.type,
      },
      orderBy: { dueDate: 'asc' },
    })
    return reply.send(rows.map(toDomainCheque))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant', 'cashier')] }, async (req, reply) => {
    const parseResult = createChequeSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { dueDate, ...rest } = parseResult.data
    const row = await prisma.cheque.create({
      data: { ...rest, dueDate: new Date(dueDate) },
    })
    return reply.code(201).send(toDomainCheque(row))
  })

  app.get('/:id', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = paramsSchema.safeParse(req.params)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }
    const row = await prisma.cheque.findUnique({ where: { id: parseResult.data.id } })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Cheque "${parseResult.data.id}" does not exist.` })
    }
    return reply.send(toDomainCheque(row))
  })

  app.post('/:id/status', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = updateChequeStatusSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id } = paramsResult.data
    const { status: newStatus } = bodyResult.data

    const cheque = await prisma.cheque.findUnique({ where: { id } })
    if (!cheque) {
      return reply.code(404).send({ error: 'NotFound', message: `Cheque "${id}" does not exist.` })
    }

    if (!isAllowedChequeTransition(cheque.status, newStatus)) {
      return reply.code(400).send({
        error: 'ValidationError',
        message: `Cannot transition cheque from "${cheque.status}" to "${newStatus}".`,
      })
    }

    const updated = await prisma.cheque.update({ where: { id }, data: { status: newStatus } })
    return reply.send(toDomainCheque(updated))
  })
}
