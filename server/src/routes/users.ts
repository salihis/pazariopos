// server/src/routes/users.ts
// ─────────────────────────────────────────────────────────────
// GET  /api/users        — list all users (admin only)
// POST /api/users        — create a new user (admin only)
// POST /api/users/me/password — change YOUR OWN password (any
//                                authenticated user, no role restriction —
//                                everyone can change their own password)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'

import { prisma } from '../db/prisma'
import { createUserSchema, changePasswordSchema } from '../schemas/auth'
import { toDomainUser } from '../mappers/userMapper'

const SALT_ROUNDS = 10

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
