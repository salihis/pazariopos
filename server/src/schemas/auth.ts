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

// PUT /api/users/:id — admin edit. `username` is deliberately NOT
// editable here, same rationale as products.ts's sku: it's the
// login identity, changing it is a delete+recreate decision.
export const updateUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['admin', 'accountant', 'cashier', 'warehouse', 'viewer']),
})

// POST /api/users/:id/reset-password — admin resets ANOTHER user's
// password (no currentPassword check, unlike /me/password — the
// admin's own auth token is the authorization here).
export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
