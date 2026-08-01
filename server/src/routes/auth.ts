// server/src/routes/auth.ts
// ─────────────────────────────────────────────────────────────
// POST /api/auth/login   — verify credentials, return a JWT
// GET  /api/auth/me      — verify the caller's token, return their user info
//                          (lets the client check "is my cached session
//                          still valid" without a full re-login)
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'

import { prisma } from '../db/prisma'
import { loginSchema } from '../schemas/auth'
import { signToken } from '../lib/jwt'
import { toDomainUser } from '../mappers/userMapper'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (req, reply) => {
    const parseResult = loginSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parseResult.error.issues })
    }

    const { username, password } = parseResult.data

    const user = await prisma.user.findUnique({ where: { username } })

    // Deliberately identical error for "no such user" and "wrong password" —
    // distinguishing them lets an attacker enumerate valid usernames.
    const invalidCredentials = () =>
      reply.code(401).send({ error: 'Unauthorized', message: 'Invalid username or password.' })

    if (!user || !user.active) {
      return invalidCredentials()
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return invalidCredentials()
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role })

    return reply.send({ token, user: toDomainUser(user) })
  })

  app.get('/me', { preHandler: app.authenticate }, async (req, reply) => {
    // req.user is guaranteed set here — app.authenticate already
    // validated the token before this handler runs.
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) {
      return reply.code(404).send({ error: 'NotFound', message: 'User no longer exists.' })
    }
    return reply.send(toDomainUser(user))
  })
}
