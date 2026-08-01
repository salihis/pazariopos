// server/src/routes/reports.ts
// ─────────────────────────────────────────────────────────────
// Read-only reporting endpoints (Gelir/Gider & Finans Phase 3).
// No new schema — these aggregate existing Sale/CashMovement/
// BankTransaction/Category data over a date range.
//
//   GET /api/reports/cash-flow?from=ISO&to=ISO
//   GET /api/reports/income-expense?from=ISO&to=ISO
//   GET /api/reports/profit-loss?from=ISO&to=ISO
//
// Plain for-loops are used instead of .reduce()/.filter() throughout —
// not just style: inline callback parameters can't infer their type
// from Prisma query results in this sandbox (missing generated client),
// which cascades into implicit-any errors under strict mode. Loops
// sidestep that entirely and work identically once Prisma is generated.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { prisma } from '../db/prisma'

const periodQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
})

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  // ── Nakit akış tablosu ──
  app.get('/cash-flow', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = periodQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const from = new Date(parseResult.data.from)
    const to = new Date(parseResult.data.to)

    const cashMovements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
    })
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: { createdAt: { gte: from, lte: to } },
    })

    let cashIn = 0
    let cashOut = 0
    for (const m of cashMovements) {
      if (m.type === 'in') cashIn += m.amount
      else cashOut += m.amount
    }

    let bankDeposits = 0
    let bankWithdrawals = 0
    for (const t of bankTransactions) {
      if (t.type === 'deposit') bankDeposits += t.amount
      else bankWithdrawals += t.amount
    }

    return reply.send({
      from: from.toISOString(),
      to: to.toISOString(),
      cashIn,
      cashOut,
      netCashFlow: cashIn - cashOut,
      bankDeposits,
      bankWithdrawals,
      netBankFlow: bankDeposits - bankWithdrawals,
      totalNetFlow: (cashIn - cashOut) + (bankDeposits - bankWithdrawals),
    })
  })

  // ── Gelir/Gider karşılaştırma ──
  app.get('/income-expense', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = periodQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const from = new Date(parseResult.data.from)
    const to = new Date(parseResult.data.to)

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to }, status: 'completed' },
    })
    let salesRevenue = 0
    for (const s of sales) salesRevenue += s.grandTotal

    const categories = await prisma.category.findMany()
    const categoryMap = new Map<string, typeof categories[number]>()
    for (const c of categories) {
      categoryMap.set(c.id, c)
    }

    const cashMovements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: from, lte: to }, categoryId: { not: null } },
    })
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: { createdAt: { gte: from, lte: to }, categoryId: { not: null } },
    })

    const totalsByCategory = new Map<string, number>()
    for (const m of cashMovements) {
      if (!m.categoryId) continue
      totalsByCategory.set(m.categoryId, (totalsByCategory.get(m.categoryId) ?? 0) + m.amount)
    }
    for (const t of bankTransactions) {
      if (!t.categoryId) continue
      totalsByCategory.set(t.categoryId, (totalsByCategory.get(t.categoryId) ?? 0) + t.amount)
    }

    const byCategory: Array<{ categoryId: string; categoryName: string; type: string; total: number }> = []
    let otherIncome = 0
    let totalExpense = 0

    for (const [categoryId, total] of totalsByCategory.entries()) {
      const category = categoryMap.get(categoryId)
      if (!category) continue
      byCategory.push({ categoryId, categoryName: category.name, type: category.type, total })
      if (category.type === 'income') otherIncome += total
      else totalExpense += total
    }

    return reply.send({
      from: from.toISOString(),
      to: to.toISOString(),
      salesRevenue,
      otherIncome,
      totalIncome: salesRevenue + otherIncome,
      totalExpense,
      byCategory,
    })
  })

  // ── Kâr/Zarar özeti ──
  app.get('/profit-loss', { preHandler: [app.authenticate, app.requireRole('admin', 'accountant')] }, async (req, reply) => {
    const parseResult = periodQuerySchema.safeParse(req.query)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const from = new Date(parseResult.data.from)
    const to = new Date(parseResult.data.to)

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: from, lte: to }, status: 'completed' },
    })
    let salesRevenue = 0
    for (const s of sales) salesRevenue += s.grandTotal

    const cashMovements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
    })
    let cashExpense = 0
    for (const m of cashMovements) {
      if (m.type === 'out') cashExpense += m.amount
    }

    const bankTransactions = await prisma.bankTransaction.findMany({
      where: { createdAt: { gte: from, lte: to } },
    })
    let bankExpense = 0
    for (const t of bankTransactions) {
      if (t.type === 'withdrawal') bankExpense += t.amount
    }

    const totalExpense = cashExpense + bankExpense

    return reply.send({
      from: from.toISOString(),
      to: to.toISOString(),
      salesRevenue,
      cashExpense,
      bankExpense,
      totalExpense,
      netProfit: salesRevenue - totalExpense,
    })
  })
}
