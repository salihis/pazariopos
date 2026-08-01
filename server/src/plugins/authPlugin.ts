// server/src/plugins/authPlugin.ts
// ─────────────────────────────────────────────────────────────
// Registers:
//   • `app.authenticate` — a preHandler that verifies the
//     `Authorization: Bearer <token>` header and attaches the decoded
//     payload to `req.user`, or replies 401 if missing/invalid.
//   • `app.requireRole(...roles)` — a preHandler factory that also
//     checks `req.user.role` is one of the allowed roles (Phase 2 RBAC).
//     Must be used AFTER `app.authenticate` in a route's preHandler array.
// ─────────────────────────────────────────────────────────────

import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

import { verifyToken, type JwtPayload } from '../lib/jwt'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireRole: (...roles: string[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    user?: JwtPayload
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing Authorization header.' })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token.' })
    }

    req.user = payload
  })

  app.decorate('requireRole', (...roles: string[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      // Assumes `authenticate` already ran and populated req.user; if it
      // didn't (route misconfiguration), fail closed rather than open.
      if (!req.user) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Missing Authorization header.' })
      }
      if (!roles.includes(req.user.role)) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: `Role "${req.user.role}" is not permitted to perform this action.`,
        })
      }
    }
  })
}

export default fp(authPlugin, { name: 'auth-plugin' })
