// server/src/routes/users.test.ts
// ─────────────────────────────────────────────────────────────
// Exercises the admin user-management endpoints added alongside
// UsersPanel.tsx: create, edit, deactivate/activate, admin
// password-reset, and self password-change. Particular focus on the
// self-lockout guard (an admin can't deactivate their own account or
// demote themselves away from admin) since that's the one invariant
// that would be genuinely painful to recover from in production if
// it regressed.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { createPrismaMock, type PrismaMock } from '../test/prismaMock'
import { buildTestApp, tokenFor } from '../test/buildTestApp'

let prismaMock: PrismaMock

vi.mock('../db/prisma', () => ({
  get prisma() {
    return prismaMock.prisma
  },
}))

function fakeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1', username: 'kasiyer1', name: 'Test Kasiyer', role: 'cashier', active: true,
    passwordHash: '$2a$10$fake', createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

describe('POST /api/users', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('rejects requests with no Authorization header (401)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/users', payload: { username: 'x', password: 'password1', name: 'X' } })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a non-admin role (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'cashier' })}` },
      payload: { username: 'newuser', password: 'password1', name: 'New User' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('creates a user as admin', async () => {
    prismaMock.prisma.user.create.mockResolvedValue(fakeUserRow({ username: 'newuser', name: 'New User' }))

    const res = await app.inject({
      method: 'POST', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { username: 'newuser', password: 'password1', name: 'New User', role: 'cashier' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().username).toBe('newuser')
    // Never leaks the password hash back to the client.
    expect(res.json().passwordHash).toBeUndefined()
  })

  it('maps a duplicate username (P2002) to 409 Conflict', async () => {
    prismaMock.prisma.user.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))

    const res = await app.inject({
      method: 'POST', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { username: 'existing', password: 'password1', name: 'Dup' },
    })

    expect(res.statusCode).toBe(409)
  })

  it('rejects a password shorter than 6 characters (400)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { username: 'newuser', password: '123', name: 'New User' },
    })
    expect(res.statusCode).toBe(400)
    expect(prismaMock.prisma.user.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/users/:id', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('updates name/role as admin', async () => {
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow({ id: 'user-2', name: 'Updated Name', role: 'accountant' }))

    const res = await app.inject({
      method: 'PUT', url: '/api/users/user-2',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
      payload: { name: 'Updated Name', role: 'accountant' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('accountant')
  })

  it('blocks an admin from demoting THEMSELVES away from admin (self-lockout guard)', async () => {
    const res = await app.inject({
      method: 'PUT', url: '/api/users/admin-1',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
      payload: { name: 'Self', role: 'cashier' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('SelfLockoutError')
    expect(prismaMock.prisma.user.update).not.toHaveBeenCalled()
  })

  it('allows an admin to edit their own name while keeping the admin role', async () => {
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow({ id: 'admin-1', name: 'New Name', role: 'admin' }))

    const res = await app.inject({
      method: 'PUT', url: '/api/users/admin-1',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
      payload: { name: 'New Name', role: 'admin' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('returns 404 for a user id that does not exist', async () => {
    prismaMock.prisma.user.update.mockRejectedValue(Object.assign(new Error('Record not found'), { code: 'P2025' }))

    const res = await app.inject({
      method: 'PUT', url: '/api/users/ghost',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
      payload: { name: 'X', role: 'cashier' },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('PATCH /api/users/:id/deactivate and /activate', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('deactivates another user as admin', async () => {
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow({ id: 'user-2', active: false }))

    const res = await app.inject({
      method: 'PATCH', url: '/api/users/user-2/deactivate',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().active).toBe(false)
  })

  it('blocks an admin from deactivating THEIR OWN account (self-lockout guard)', async () => {
    const res = await app.inject({
      method: 'PATCH', url: '/api/users/admin-1/deactivate',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('SelfLockoutError')
    expect(prismaMock.prisma.user.update).not.toHaveBeenCalled()
  })

  it('reactivates a user', async () => {
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow({ id: 'user-2', active: true }))

    const res = await app.inject({
      method: 'PATCH', url: '/api/users/user-2/activate',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin', userId: 'admin-1' })}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().active).toBe(true)
  })
})

describe('POST /api/users/:id/reset-password', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('admin resets another user\'s password with no current-password check', async () => {
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow())

    const res = await app.inject({
      method: 'POST', url: '/api/users/user-2/reset-password',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
      payload: { newPassword: 'brandnewpassword' },
    })

    expect(res.statusCode).toBe(200)
    expect(prismaMock.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-2' } }),
    )
  })

  it('rejects a non-admin (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/users/user-2/reset-password',
      headers: { authorization: `Bearer ${tokenFor({ role: 'cashier' })}` },
      payload: { newPassword: 'brandnewpassword' },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('POST /api/users/me/password', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('any authenticated role can change their own password with the correct current password', async () => {
    const realHash = await bcrypt.hash('correct-current-password', 10)
    prismaMock.prisma.user.findUnique.mockResolvedValue(fakeUserRow({ id: 'user-1', passwordHash: realHash }))
    prismaMock.prisma.user.update.mockResolvedValue(fakeUserRow({ id: 'user-1' }))

    const res = await app.inject({
      method: 'POST', url: '/api/users/me/password',
      headers: { authorization: `Bearer ${tokenFor({ role: 'cashier', userId: 'user-1' })}` },
      payload: { currentPassword: 'correct-current-password', newPassword: 'a-brand-new-password' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('rejects an incorrect current password (401)', async () => {
    const realHash = await bcrypt.hash('the-real-password', 10)
    prismaMock.prisma.user.findUnique.mockResolvedValue(fakeUserRow({ id: 'user-1', passwordHash: realHash }))

    const res = await app.inject({
      method: 'POST', url: '/api/users/me/password',
      headers: { authorization: `Bearer ${tokenFor({ role: 'cashier', userId: 'user-1' })}` },
      payload: { currentPassword: 'wrong-password', newPassword: 'a-brand-new-password' },
    })

    expect(res.statusCode).toBe(401)
    expect(prismaMock.prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('GET /api/users', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    prismaMock = createPrismaMock()
    const { usersRoutes } = await import('./users')
    app = await buildTestApp(usersRoutes, '/api/users')
  })

  afterEach(async () => {
    await app.close()
    vi.resetModules()
  })

  it('lists users as admin, never leaking passwordHash', async () => {
    prismaMock.prisma.user.findMany.mockResolvedValue([fakeUserRow(), fakeUserRow({ id: 'user-2', username: 'admin' })])

    const res = await app.inject({
      method: 'GET', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'admin' })}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(2)
    expect(body.every((u: Record<string, unknown>) => u.passwordHash === undefined)).toBe(true)
  })

  it('rejects a non-admin (403)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/users',
      headers: { authorization: `Bearer ${tokenFor({ role: 'viewer' })}` },
    })
    expect(res.statusCode).toBe(403)
  })
})
