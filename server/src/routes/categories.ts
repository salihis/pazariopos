// server/src/routes/categories.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/categories        — list, optionally filtered by type
// POST /api/categories        — create (supports parentId for the
//                                hierarchical Gelir/Gider tree)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { prisma } from '../db/prisma'
import { createCategorySchema } from '../schemas/finance'
import { toDomainCategory } from '../mappers/financeMapper'

const listQuerySchema = z.object({
  type: z.enum(['income', 'expense', 'product']).optional(),
})

export const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = listQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const rows = await prisma.category.findMany({
      where: parseResult.data.type ? { type: parseResult.data.type } : undefined,
      orderBy: { name: 'asc' },
    })
    return reply.send(rows.map(toDomainCategory))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = createCategorySchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    if (parseResult.data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parseResult.data.parentId } })
      if (!parent) {
        return reply.code(400).send({ error: 'ValidationError', message: 'parentId does not reference an existing category.' })
      }
    }

    const row = await prisma.category.create({ data: parseResult.data })
    return reply.code(201).send(toDomainCategory(row))
  })
}
