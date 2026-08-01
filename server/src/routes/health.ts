// server/src/routes/health.ts
// ─────────────────────────────────────────────────────────────
// NetworkMonitor (packages/core) pings this with a HEAD request
// every `pingIntervalMs`. Keep this handler trivially cheap —
// no DB calls — so it never becomes the bottleneck it's supposed
// to be checking for.
// ─────────────────────────────────────────────────────────────

import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Fastify v5 auto-generates a HEAD route from this GET route by default
  // (`exposeHeadRoutes: true`), which is exactly what NetworkMonitor's
  // `method: 'HEAD'` ping needs. Registering `app.head('/', ...)` here too
  // used to throw FST_ERR_DUPLICATED_ROUTE — don't re-add it.
  app.get('/', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))
}
