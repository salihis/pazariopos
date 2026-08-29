// server/src/routes/quickSaleGroups.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/quick-sale-groups  — list (flat, no parentId — see
//                                 schema.prisma's QuickSaleGroup comment)
// POST /api/quick-sale-groups  — create
//
// Controls ONLY which products show up as tappable tiles in the POS
// "Hızlı Ürünler" quick-add grid, and under which tab. Deliberately
// independent of Category (the Ana/Alt Kategori accounting tree) —
// see Product.quickSaleGroupId in schema.prisma.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'

import { prisma } from '../db/prisma'
import { createQuickSaleGroupSchema } from '../schemas/quickSaleGroup'
import { toDomainQuickSaleGroup } from '../mappers/quickSaleGroupMapper'

export const quickSaleGroupsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: app.authenticate }, async (_req, reply) => {
    const rows = await prisma.quickSaleGroup.findMany({ orderBy: { name: 'asc' } })
    return reply.send(rows.map(toDomainQuickSaleGroup))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const parseResult = createQuickSaleGroupSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    try {
      const row = await prisma.quickSaleGroup.create({ data: parseResult.data })
      return reply.code(201).send(toDomainQuickSaleGroup(row))
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        return reply.code(409).send({ error: 'Conflict', message: 'Bu isimde bir hızlı ürün grubu zaten var.' })
      }
      app.log.error(err, 'Failed to create quick-sale group')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not create quick-sale group.' })
    }
  })
}
