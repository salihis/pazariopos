// server/src/db/prisma.ts
// ─────────────────────────────────────────────────────────────
// Prisma client singleton. Import this everywhere instead of
// `new PrismaClient()` — avoids exhausting the PostgreSQL
// connection pool during dev hot-reload (tsx watch).
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma = globalThis.__prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
