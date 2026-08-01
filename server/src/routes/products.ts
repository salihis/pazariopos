// server/src/routes/products.ts
// ─────────────────────────────────────────────────────────────
// Minimal Inventory MVP surface (see server/prisma/schema.prisma
// Product model comment for scope notes):
//   GET   /api/products             — full catalog (client caches
//                                      it locally for barcode lookup
//                                      and offline reads, per
//                                      ARCHITECTURE.md §7: inventory
//                                      reads are safe to serve stale)
//   POST  /api/products             — create a product
//   PATCH /api/products/:id/stock   — manual stock adjustment
//                                      (restock, shrinkage correction)
//
// Sale-driven stock decrements do NOT go through this file — they
// happen inside routes/sales.ts's own transaction, atomically with
// the sale insert, so a stock update can never happen without the
// sale that caused it (or vice versa).
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { prisma } from '../db/prisma'
import { createProductSchema, adjustStockSchema } from '../schemas/product'
import { toDomainProduct } from '../mappers/productMapper'

const paramsSchema = z.object({ id: z.string().min(1) })

export const productsRoutes: FastifyPluginAsync = async (app) => {
  // ── GET /api/products — full catalog ──
  app.get('/', { preHandler: app.authenticate }, async (_req, reply) => {
    const rows = await prisma.product.findMany({ orderBy: { name: 'asc' } })
    return reply.send(rows.map(toDomainProduct))
  })

  // ── POST /api/products — create ──
  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const parseResult = createProductSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    try {
      const row = await prisma.product.create({ data: parseResult.data })
      return reply.code(201).send(toDomainProduct(row))
    } catch (err) {
      // Prisma throws P2002 on the unique `sku` constraint.
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        return reply.code(409).send({ error: 'Conflict', message: 'SKU already exists.' })
      }
      app.log.error(err, 'Failed to create product')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not create product.' })
    }
  })

  // ── PATCH /api/products/:id/stock — manual adjustment ──
  app.patch('/:id/stock', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = adjustStockSchema.safeParse(req.body)

    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id } = paramsResult.data
    const { delta, reason } = bodyResult.data

    try {
      const row = await prisma.product.update({
        where: { id },
        data: { stock: { increment: delta } },
      })

      app.log.info({ productId: id, delta, reason, newStock: row.stock }, 'Manual stock adjustment')
      return reply.send(toDomainProduct(row))
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(404).send({ error: 'NotFound', message: `Product "${id}" does not exist.` })
      }
      app.log.error(err, 'Failed to adjust stock')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not adjust stock.' })
    }
  })
}
