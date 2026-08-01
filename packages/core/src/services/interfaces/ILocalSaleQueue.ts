// packages/core/src/services/interfaces/ILocalSaleQueue.ts
// ─────────────────────────────────────────────────────────────
// Abstraction over "where does an offline sale get parked until
// we can reach the server". Desktop persists to SQLite (survives
// app restart); web keeps an in-memory queue only, matching the
// architecture doc's "Offline Mode: ⚠️ Limited" rating for web.
// ─────────────────────────────────────────────────────────────

import type { Sale, SyncQueueItem } from '../../types/domain'

export interface ILocalSaleQueue {
  /** Persists a sale locally and enqueues it for later sync. */
  enqueue(sale: Sale): Promise<void>

  /** Returns all sales currently awaiting sync, oldest first. */
  listPending(): Promise<SyncQueueItem[]>

  /** Marks a queued item as successfully synced (removes it from the queue). */
  markCompleted(queueId: string, recordId: string): Promise<void>

  /** Marks a queued item as failed (kept in queue, retry_count incremented). */
  markFailed(queueId: string, error: string): Promise<void>
}
