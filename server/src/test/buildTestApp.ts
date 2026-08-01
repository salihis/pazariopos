// server/src/test/buildTestApp.ts
// ─────────────────────────────────────────────────────────────
// Builds a minimal Fastify instance with the REAL auth plugin
// (app.authenticate / app.requireRole) so route tests also exercise
// RBAC as it actually runs in production — only the Prisma client is
// swapped for a mock (see prismaMock.ts and each test's vi.mock call).
// ─────────────────────────────────────────────────────────────

import Fastify from 'fastify'
import type { FastifyPluginAsync } from 'fastify'
import authPlugin from '../plugins/authPlugin'
import { signToken, type JwtPayload } from '../lib/jwt'

export async function buildTestApp(routes: FastifyPluginAsync, prefix = '/api/sales') {
  const app = Fastify({ logger: false })
  await app.register(authPlugin)
  await app.register(routes, { prefix })
  await app.ready()
  return app
}

export function tokenFor(payload: Partial<JwtPayload> = {}): string {
  return signToken({
    userId: 'user-1',
    username: 'test-user',
    role: 'cashier',
    ...payload,
  })
}
