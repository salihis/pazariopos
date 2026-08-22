// server/src/routes/stockCounts.ts
// ─────────────────────────────────────────────────────────────
// Stok Sayım (physical inventory count) — draft/complete lifecycle.
// See server/prisma/schema.prisma's StockCount/StockCountItem comment.
//
//   POST   /api/stock-counts               — start a new count, OR
//                                             resume the caller's
//                                             existing open draft if
//                                             one already exists (this
//                                             is what lets the UI
//                                             "kaldığım yerden devam
//                                             et" after a page reload
//                                             or on a different device)
//   GET    /api/stock-counts/draft         — the caller's open draft
//                                             (with items), or 404
//   GET    /api/stock-counts/:id           — detail (with items)
//   GET    /api/stock-counts               — history list
//   POST   /api/stock-counts/:id/items     — upsert one product's
//                                             counted quantity
//   DELETE /api/stock-counts/:id/items/:productId — remove a mis-scan
//   POST   /api/stock-counts/:id/complete  — "Sayımı Aktar": writes
//                                             every item's countedStock
//                                             onto Product.stock,
//                                             atomically, in one
//                                             transaction
//
// Only 'draft' counts accept item changes or completion — a
// 'completed' count is a closed historical record, same spirit as
// Sale.status/Purchase not allowing post-hoc line edits.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '../db/prisma'
import { startStockCountSchema, upsertStockCountItemSchema } from '../schemas/stockCount'
import { toDomainStockCount } from '../mappers/stockCountMapper'

const paramsSchema = z.object({ id: z.string().min(1) })
const itemParamsSchema = z.object({ id: z.string().min(1), productId: z.string().min(1) })
const listQuerySchema = z.object({ status: z.enum(['draft', 'completed']).optional() })

const stockCountInclude = { items: { orderBy: { countedAt: 'desc' } } } satisfies Prisma.StockCountInclude

class StockCountNotFoundError extends Error {
  constructor(id: string) {
    super(`Stock count "${id}" does not exist.`)
    this.name = 'StockCountNotFoundError'
  }
}

class StockCountNotDraftError extends Error {
  constructor(id: string) {
    super(`Stock count "${id}" is already completed and can no longer be changed.`)
    this.name = 'StockCountNotDraftError'
  }
}

class ProductNotFoundError extends Error {
  constructor(id: string) {
    super(`Product "${id}" does not exist.`)
    this.name = 'ProductNotFoundError'
  }
}

export const stockCountsRoutes: FastifyPluginAsync = async (app) => {
  // ── POST / — start new, or resume the caller's existing draft ──
  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const parseResult = startStockCountSchema.safeParse(req.body ?? {})
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const userId = req.user!.userId

    const existingDraft = await prisma.stockCount.findFirst({
      where: { userId, status: 'draft' },
      include: stockCountInclude,
      orderBy: { startedAt: 'desc' },
    })
    if (existingDraft) {
      return reply.send(toDomainStockCount(existingDraft))
    }

    const row = await prisma.stockCount.create({
      data: { warehouseId: parseResult.data.warehouseId, userId },
      include: stockCountInclude,
    })
    return reply.code(201).send(toDomainStockCount(row))
  })

  // ── GET /draft — the caller's open draft, if any ──
  // Registered before /:id so it isn't swallowed by that param route.
  app.get('/draft', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const userId = req.user!.userId
    const row = await prisma.stockCount.findFirst({
      where: { userId, status: 'draft' },
      include: stockCountInclude,
      orderBy: { startedAt: 'desc' },
    })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: 'No open stock count for this user.' })
    }
    return reply.send(toDomainStockCount(row))
  })

  // ── GET / — history list ──
  app.get('/', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse', 'accountant')] }, async (req, reply) => {
    const queryResult = listQuerySchema.safeParse(req.query)
    if (!queryResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: queryResult.error.issues })
    }
    const rows = await prisma.stockCount.findMany({
      where: queryResult.data.status ? { status: queryResult.data.status } : {},
      include: stockCountInclude,
      orderBy: { startedAt: 'desc' },
    })
    return reply.send(rows.map(toDomainStockCount))
  })

  // ── GET /:id — detail ──
  app.get('/:id', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse', 'accountant')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: paramsResult.error.issues })
    }
    const row = await prisma.stockCount.findUnique({ where: { id: paramsResult.data.id }, include: stockCountInclude })
    if (!row) {
      return reply.code(404).send({ error: 'NotFound', message: `Stock count "${paramsResult.data.id}" does not exist.` })
    }
    return reply.send(toDomainStockCount(row))
  })

  // ── POST /:id/items — upsert one product's counted quantity ──
  app.post('/:id/items', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = upsertStockCountItemSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const { id: stockCountId } = paramsResult.data
    const { productId, countedStock } = bodyResult.data

    try {
      const row = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const count = await tx.stockCount.findUnique({ where: { id: stockCountId } })
        if (!count) throw new StockCountNotFoundError(stockCountId)
        if (count.status !== 'draft') throw new StockCountNotDraftError(stockCountId)

        const product = await tx.product.findUnique({ where: { id: productId } })
        if (!product) throw new ProductNotFoundError(productId)

        await tx.stockCountItem.upsert({
          where: { stockCountId_productId: { stockCountId, productId } },
          create: {
            stockCountId, productId,
            productName: product.name, productSku: product.sku,
            previousStock: product.stock, countedStock,
          },
          // previousStock is intentionally NOT overwritten on a re-scan —
          // it stays pinned to the stock level at first count, so the
          // eventual difference report reflects the count session's
          // starting point, not a stale mid-session read.
          update: { countedStock },
        })

        return tx.stockCount.findUniqueOrThrow({ where: { id: stockCountId }, include: stockCountInclude })
      })

      return reply.send(toDomainStockCount(row))
    } catch (err) {
      if (err instanceof StockCountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      if (err instanceof ProductNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      if (err instanceof StockCountNotDraftError) {
        return reply.code(409).send({ error: 'Conflict', message: err.message })
      }
      app.log.error(err, 'Failed to upsert stock count item')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not record counted quantity.' })
    }
  })

  // ── DELETE /:id/items/:productId — remove a mis-scan ──
  app.delete('/:id/items/:productId', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const paramsResult = itemParamsSchema.safeParse(req.params)
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: paramsResult.error.issues })
    }
    const { id: stockCountId, productId } = paramsResult.data

    try {
      const row = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const count = await tx.stockCount.findUnique({ where: { id: stockCountId } })
        if (!count) throw new StockCountNotFoundError(stockCountId)
        if (count.status !== 'draft') throw new StockCountNotDraftError(stockCountId)

        await tx.stockCountItem.delete({
          where: { stockCountId_productId: { stockCountId, productId } },
        }).catch(() => { /* already gone — deleting is idempotent */ })

        return tx.stockCount.findUniqueOrThrow({ where: { id: stockCountId }, include: stockCountInclude })
      })

      return reply.send(toDomainStockCount(row))
    } catch (err) {
      if (err instanceof StockCountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      if (err instanceof StockCountNotDraftError) {
        return reply.code(409).send({ error: 'Conflict', message: err.message })
      }
      app.log.error(err, 'Failed to remove stock count item')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not remove item.' })
    }
  })

  // ── POST /:id/complete — "Sayımı Aktar" ──
  // Writes every item's countedStock onto Product.stock (overwrite, not
  // delta — see schema.prisma comment) and closes the count. All in one
  // transaction: either every product gets the new count or none do.
  app.post('/:id/complete', { preHandler: [app.authenticate, app.requireRole('admin', 'warehouse')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: paramsResult.error.issues })
    }
    const { id: stockCountId } = paramsResult.data

    try {
      const row = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const count = await tx.stockCount.findUnique({ where: { id: stockCountId }, include: stockCountInclude })
        if (!count) throw new StockCountNotFoundError(stockCountId)
        if (count.status !== 'draft') throw new StockCountNotDraftError(stockCountId)

        for (const item of count.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: item.countedStock },
          })
        }

        return tx.stockCount.update({
          where: { id: stockCountId },
          data: { status: 'completed', completedAt: new Date() },
          include: stockCountInclude,
        })
      })

      app.log.info({ stockCountId, itemCount: row.items.length }, 'Stock count transferred to product stock')
      return reply.send(toDomainStockCount(row))
    } catch (err) {
      if (err instanceof StockCountNotFoundError) {
        return reply.code(404).send({ error: 'NotFound', message: err.message })
      }
      if (err instanceof StockCountNotDraftError) {
        return reply.code(409).send({ error: 'Conflict', message: err.message })
      }
      app.log.error(err, 'Failed to complete stock count')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not transfer stock count.' })
    }
  })
}
