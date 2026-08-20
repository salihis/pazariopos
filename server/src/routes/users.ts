// server/src/routes/users.ts
// ─────────────────────────────────────────────────────────────
// GET   /api/users               — list all users (admin only)
// POST  /api/users               — create a new user (admin only)
// PUT   /api/users/:id           — edit name/role (admin only)
// PATCH /api/users/:id/deactivate, /activate — soft-disable login (admin only)
// POST  /api/users/:id/reset-password        — admin sets a NEW password
//                                    for another user, no current-password
//                                    check needed (the admin's own auth
//                                    token is the authorization here)
// POST  /api/users/me/password   — change YOUR OWN password (any
//                                   authenticated user, no role restriction —
//                                   everyone can change their own password)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '../db/prisma'
import { createUserSchema, updateUserSchema, resetPasswordSchema, changePasswordSchema } from '../schemas/auth'
import { toDomainUser } from '../mappers/userMapper'

const SALT_ROUNDS = 10
const paramsSchema = z.object({ id: z.string().min(1) })

class SelfLockoutError extends Error {
  constructor() {
    super('You cannot deactivate your own account or remove your own admin role.')
    this.name = 'SelfLockoutError'
  }
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (_req, reply) => {
    const rows = await prisma.user.findMany({ orderBy: { username: 'asc' } })
    return reply.send(rows.map(toDomainUser))
  })

  app.post('/', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (req, reply) => {
    const parseResult = createUserSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { username, password, name, role } = parseResult.data
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    try {
      const row = await prisma.user.create({ data: { username, passwordHash, name, role } })
      return reply.code(201).send(toDomainUser(row))
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        return reply.code(409).send({ error: 'Conflict', message: 'Username already exists.' })
      }
      app.log.error(err, 'Failed to create user')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not create user.' })
    }
  })

  // ── PUT /api/users/:id — edit name/role ──
  app.put('/:id', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = updateUserSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    if (paramsResult.data.id === req.user!.userId && bodyResult.data.role !== 'admin') {
      return reply.code(400).send({ error: 'SelfLockoutError', message: new SelfLockoutError().message })
    }

    try {
      const row = await prisma.user.update({ where: { id: paramsResult.data.id }, data: bodyResult.data })
      return reply.send(toDomainUser(row))
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(404).send({ error: 'NotFound', message: `User "${paramsResult.data.id}" does not exist.` })
      }
      app.log.error(err, 'Failed to update user')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not update user.' })
    }
  })

  // ── PATCH /api/users/:id/deactivate, /activate ──
  // Soft-disable only, same rationale as products.ts: a deactivated
  // user's historical Sale.cashierId / Purchase.userId references stay
  // intact; they just can't log in anymore (see authPlugin.ts).
  for (const [suffix, active] of [['deactivate', false], ['activate', true]] as const) {
    app.patch(`/:id/${suffix}`, { preHandler: [app.authenticate, app.requireRole('admin')] }, async (req, reply) => {
      const paramsResult = paramsSchema.safeParse(req.params)
      if (!paramsResult.success) {
        return reply.code(400).send({ error: 'ValidationError', issues: paramsResult.error.issues })
      }
      if (suffix === 'deactivate' && paramsResult.data.id === req.user!.userId) {
        return reply.code(400).send({ error: 'SelfLockoutError', message: new SelfLockoutError().message })
      }
      try {
        const row = await prisma.user.update({ where: { id: paramsResult.data.id }, data: { active } })
        return reply.send(toDomainUser(row))
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
          return reply.code(404).send({ error: 'NotFound', message: `User "${paramsResult.data.id}" does not exist.` })
        }
        app.log.error(err, `Failed to ${suffix} user`)
        return reply.code(500).send({ error: 'InternalError', message: `Could not ${suffix} user.` })
      }
    })
  }

  // ── POST /api/users/:id/reset-password — admin resets someone else's password ──
  app.post('/:id/reset-password', { preHandler: [app.authenticate, app.requireRole('admin')] }, async (req, reply) => {
    const paramsResult = paramsSchema.safeParse(req.params)
    const bodyResult = resetPasswordSchema.safeParse(req.body)
    if (!paramsResult.success || !bodyResult.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: [...(paramsResult.success ? [] : paramsResult.error.issues), ...(bodyResult.success ? [] : bodyResult.error.issues)],
      })
    }

    const passwordHash = await bcrypt.hash(bodyResult.data.newPassword, SALT_ROUNDS)
    try {
      await prisma.user.update({ where: { id: paramsResult.data.id }, data: { passwordHash } })
      return reply.send({ message: 'Password reset.' })
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2025') {
        return reply.code(404).send({ error: 'NotFound', message: `User "${paramsResult.data.id}" does not exist.` })
      }
      app.log.error(err, 'Failed to reset password')
      return reply.code(500).send({ error: 'InternalError', message: 'Could not reset password.' })
    }
  })

  app.post('/me/password', { preHandler: app.authenticate }, async (req, reply) => {
    const parseResult = changePasswordSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { currentPassword, newPassword } = parseResult.data
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) {
      return reply.code(404).send({ error: 'NotFound', message: 'User no longer exists.' })
    }

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!currentMatches) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Current password is incorrect.' })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } })

    return reply.send({ message: 'Password updated.' })
  })
}
