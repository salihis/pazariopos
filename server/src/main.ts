// server/src/main.ts
// ─────────────────────────────────────────────────────────────
// Fastify v5 API entry point.
// Serves the endpoints consumed by packages/core/src/api/salesApi.ts:
//   GET  /api/health              — used by NetworkMonitor's ping
//   POST /api/sales               — online sale submission
//   POST /api/sales/sync          — sync engine pushes queued sales
//   GET  /api/accounts/:id/balance — MUST be reachable only when online
//   GET  /api/products            — inventory catalog (Inventory MVP)
// ─────────────────────────────────────────────────────────────

// MUST be the first import: db/prisma.ts and lib/jwt.ts read process.env
// at module-evaluation time (e.g. `new PrismaClient()`, `JWT_SECRET =
// process.env.JWT_SECRET ?? ...`), so .env has to be loaded before
// anything else in the import graph runs. Verified empirically that
// nothing else here does this automatically — neither `tsx watch` nor
// instantiating PrismaClient populates process.env from .env on its
// own; most vars only "worked" in dev because of the `?? 'fallback'`
// defaults below (lib/jwt.ts, this file) masking the gap. DATABASE_URL
// has no such fallback, so production would fail hard without this.
import 'dotenv/config'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import path from 'node:path'

import authPlugin              from './plugins/authPlugin'
import { authRoutes }          from './routes/auth'
import { usersRoutes }         from './routes/users'
import { healthRoutes }        from './routes/health'
import { salesRoutes }         from './routes/sales'
import { purchasesRoutes }     from './routes/purchases'
import { accountsRoutes }      from './routes/accounts'
import { productsRoutes }      from './routes/products'
import { stockCountsRoutes }   from './routes/stockCounts'
import { categoriesRoutes }    from './routes/categories'
import { quickSaleGroupsRoutes } from './routes/quickSaleGroups'
import { cashRegistersRoutes } from './routes/cashRegisters'
import { bankAccountsRoutes }  from './routes/bankAccounts'
import { chequesRoutes }       from './routes/cheques'
import { reportsRoutes }       from './routes/reports'

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  await app.register(cors, {
    // Dev origins (Vite dev servers) + the packaged Tauri app's production
    // origin. Tauri v2 serves the built frontend from `https://tauri.localhost`
    // on Windows (not http://localhost:1420 — that's dev-mode only), so
    // without this the *installed* desktop app gets CORS-blocked even when
    // the server is running and reachable.
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://localhost:1420',
      'https://tauri.localhost',
      'tauri://localhost',
    ],
  })

  // Product image uploads (routes/products.ts). 8 MiB is comfortably
  // above any reasonable photo taken for a product listing, while still
  // well under nginx's `client_max_body_size 10m` in front of this
  // (deploy/nginx.pazariopos.snippet.conf) — a larger upload would 413
  // at nginx before even reaching here.
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  })

  // Serves whatever routes/products.ts's image-upload route saves —
  // UPLOADS_DIR MUST point at a persistent Docker volume (see
  // deploy/docker-compose.pazariopos.yml's pazariopos_uploads volume),
  // never the container's own filesystem, which is wiped on every
  // redeploy. Exposed at /api/uploads/... so the existing nginx routing
  // (everything under /api/ → this server) reaches it with zero nginx
  // config changes.
  const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads')
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/api/uploads/',
    decorateReply: false,
  })

  await app.register(authPlugin)

  await app.register(authRoutes,          { prefix: '/api/auth' })
  await app.register(usersRoutes,         { prefix: '/api/users' })
  await app.register(healthRoutes,        { prefix: '/api/health' })
  await app.register(salesRoutes,         { prefix: '/api/sales' })
  await app.register(purchasesRoutes,     { prefix: '/api/purchases' })
  await app.register(accountsRoutes,      { prefix: '/api/accounts' })
  await app.register(productsRoutes,      { prefix: '/api/products' })
  await app.register(stockCountsRoutes,   { prefix: '/api/stock-counts' })
  await app.register(categoriesRoutes,    { prefix: '/api/categories' })
  await app.register(quickSaleGroupsRoutes, { prefix: '/api/quick-sale-groups' })
  await app.register(cashRegistersRoutes, { prefix: '/api/cash-registers' })
  await app.register(bankAccountsRoutes,  { prefix: '/api/bank-accounts' })
  await app.register(chequesRoutes,       { prefix: '/api/cheques' })
  await app.register(reportsRoutes,       { prefix: '/api/reports' })

  return app
}

buildServer()
  .then(app => app.listen({ port: PORT, host: HOST }))
  .then(() => {
    console.log(`[server] listening on http://localhost:${PORT}`)
  })
  .catch(err => {
    console.error('[server] failed to start:', err)
    process.exit(1)
  })
