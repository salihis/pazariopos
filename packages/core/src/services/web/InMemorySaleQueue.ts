// packages/core/src/services/web/InMemorySaleQueue.ts
// ─────────────────────────────────────────────────────────────
// Web implementation of ILocalSaleQueue.
//
// Per the architecture doc, offline support on web is intentionally
// LIMITED (⚠️) rather than full: this queue lives in memory only and
// does NOT survive a tab reload. This is a deliberate scope boundary,
// not an oversight — full offline durability on web is the desktop
// app's job (SQLite-backed TauriLocalSaleQueue). If a browser tab
// closes while sales are queued, they are lost, and the UI must warn
// the cashier accordingly (see useSaleStore's `pendingCount` state).
// ─────────────────────────────────────────────────────────────

import type { ILocalSaleQueue } from '../interfaces/ILocalSaleQueue'
import type { Sale, SyncQueueItem } from '../../types/domain'

interface QueueEntry {
  item: SyncQueueItem
  sale: Sale
}

export class InMemorySaleQueue implements ILocalSaleQueue {
  private queue: QueueEntry[] = []

  async enqueue(sale: Sale): Promise<void> {
    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      tableName: 'sales',
      operation: 'INSERT',
      recordId: sale.localId,
      payload: JSON.stringify(sale),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }
    this.queue.push({ item, sale })
  }

  async listPending(): Promise<SyncQueueItem[]> {
    return this.queue.map(entry => entry.item)
  }

  async markCompleted(queueId: string): Promise<void> {
    this.queue = this.queue.filter(entry => entry.item.id !== queueId)
  }

  async markFailed(queueId: string, error: string): Promise<void> {
    const entry = this.queue.find(e => e.item.id === queueId)
    if (entry) {
      entry.item.retryCount += 1
      entry.item.lastError = error
    }
  }
}
