// server/src/test/prismaMock.ts
// ─────────────────────────────────────────────────────────────
// A hand-rolled mock of the slice of PrismaClient that routes/sales.ts
// touches. We do NOT use a real PrismaClient here: this sandbox cannot
// reach binaries.prisma.sh to download the query engine (expected,
// documented in references/troubleshooting-and-design.md — not a bug),
// and more importantly, mocking at this boundary lets us assert on
// exactly which queries ran, in which order, inside vs. outside the
// transaction — which is the actual thing routes/sales.ts promises
// (see its top-of-file comment on atomicity).
//
// A separate, real-Postgres integration suite (sales.route.integration.test.ts)
// covers the same behavior end-to-end against an actual DB; run it in any
// environment with a working `prisma generate` (CI, or the user's machine).
// ─────────────────────────────────────────────────────────────

import { vi } from 'vitest'

export function createPrismaMock() {
  const tx = {
    sale: { create: vi.fn() },
    product: { update: vi.fn() },
    account: { findUnique: vi.fn(), update: vi.fn() },
    accountTransaction: { create: vi.fn() },
    cashRegister: { findUnique: vi.fn(), update: vi.fn() },
    cashMovement: { create: vi.fn() },
  }

  type TxMock = typeof tx

  const prisma = {
    sale: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (txArg: TxMock) => unknown) => {
      return callback(tx)
    }),
  }

  return { prisma, tx }
}

export type PrismaMock = ReturnType<typeof createPrismaMock>
