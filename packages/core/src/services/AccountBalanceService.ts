// packages/core/src/services/AccountBalanceService.ts
// ─────────────────────────────────────────────────────────────
// Enforces architecture rule (§7 OFFLINE MODE):
//   "Account balances: require online (risk of inconsistency)"
//
// Unlike sales/inventory, a balance read has no safe offline
// fallback — serving a stale cached balance could let a cashier
// approve a sale against a customer who is actually over their
// credit limit. So this service refuses outright when offline,
// rather than silently returning cached/stale data.
// ─────────────────────────────────────────────────────────────

import { accountsApi } from '../api/salesApi'
import { getNetworkMonitor } from './NetworkMonitor'

export class OfflineBalanceError extends Error {
  constructor(accountId: string) {
    super(
      `Cannot fetch balance for account "${accountId}" while offline. ` +
      `Account balances require a live connection to avoid approving sales ` +
      `against stale credit data.`,
    )
    this.name = 'OfflineBalanceError'
  }
}

export interface AccountBalance {
  accountId: string
  balance: number
  asOf: string
}

export const accountBalanceService = {
  async getBalance(accountId: string): Promise<AccountBalance> {
    const monitor = getNetworkMonitor()

    if (!monitor.isOnline()) {
      throw new OfflineBalanceError(accountId)
    }

    return accountsApi.getBalance(accountId)
  },
}
