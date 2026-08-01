// server/src/mappers/userMapper.ts
// ─────────────────────────────────────────────────────────────
// Converts a Prisma `User` row into the domain `User` shape.
// Deliberately NEVER includes passwordHash — this is the one
// boundary in the whole codebase where leaving a field out is a
// security requirement, not just a design choice.
// ─────────────────────────────────────────────────────────────

import type { User as PrismaUser } from '@prisma/client'
import type { User } from '@pazariopos/core/types'

export function toDomainUser(row: PrismaUser): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
