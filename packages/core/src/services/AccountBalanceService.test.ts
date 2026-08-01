// packages/core/src/services/AccountBalanceService.test.ts
// ─────────────────────────────────────────────────────────────
// Covers ARCHITECTURE.md §7's rule for Account balances: "require
// online (risk of inconsistency)". Unlike InventoryService, this
// service must NEVER serve a stale/cached balance — see the class
// doc comment in AccountBalanceService.ts.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'

async function setup(online: boolean, getBalance = vi.fn()) {
  vi.resetModules()
  vi.doMock('./NetworkMonitor', () => ({
    getNetworkMonitor: () => ({ isOnline: () => online }),
  }))
  vi.doMock('../api/salesApi', () => ({
    accountsApi: { getBalance },
  }))
  const mod = await import('./AccountBalanceService')
  return { service: mod.accountBalanceService, OfflineBalanceError: mod.OfflineBalanceError, getBalance }
}

describe('AccountBalanceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the live balance when online', async () => {
    const expected = { accountId: 'acc-1', balance: 15000, asOf: '2026-07-31T00:00:00.000Z' }
    const getBalance = vi.fn(async () => expected)
    const { service } = await setup(true, getBalance)

    const result = await service.getBalance('acc-1')

    expect(result).toEqual(expected)
    expect(getBalance).toHaveBeenCalledWith('acc-1')
  })

  it('throws OfflineBalanceError when offline, WITHOUT calling the API', async () => {
    const getBalance = vi.fn()
    const { service, OfflineBalanceError } = await setup(false, getBalance)

    await expect(service.getBalance('acc-1')).rejects.toThrow(OfflineBalanceError)
    expect(getBalance).not.toHaveBeenCalled()
  })

  it('OfflineBalanceError message includes the account id for support/debugging', async () => {
    const { service } = await setup(false)

    await expect(service.getBalance('acc-42')).rejects.toThrow(/acc-42/)
  })

  it('propagates API errors unchanged when online (e.g. account not found)', async () => {
    const getBalance = vi.fn(async () => { throw new Error('Account not found') })
    const { service } = await setup(true, getBalance)

    await expect(service.getBalance('missing')).rejects.toThrow('Account not found')
  })
})
