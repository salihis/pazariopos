// server/src/schemas/auth.ts
// ─────────────────────────────────────────────────────────────
// Validation for /api/auth/* and /api/users endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const createUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['admin', 'accountant', 'cashier', 'warehouse', 'viewer']).default('cashier'),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
