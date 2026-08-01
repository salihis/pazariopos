// packages/core/src/services/desktop/TauriLocalSaleQueue.ts
// ─────────────────────────────────────────────────────────────
// Desktop implementation of ILocalSaleQueue.
// Every method is a thin invoke() call into commands/sales.rs —
// the actual SQLite transaction logic lives entirely in Rust
// (see db/sync_queue.rs) so both the schema and the "queue + sale
// row in one transaction" guarantee live in a single place.
// ─────────────────────────────────────────────────────────────

import { invoke } from '@tauri-apps/api/core'

import type { ILocalSaleQueue } from '../interfaces/ILocalSaleQueue'
import type { Sale, SyncQueueItem } from '../../types/domain'
import { platform } from '../../platform/PlatformDetectionService'

interface RustSyncQueueItem {
  id: string
  table_name: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  record_id: string
  payload: string
  created_at: string
  retry_count: number
}

function fromRust(item: RustSyncQueueItem): SyncQueueItem {
  return {
    id: item.id,
    tableName: item.table_name,
    operation: item.operation,
    recordId: item.record_id,
    payload: item.payload,
    createdAt: item.created_at,
    retryCount: item.retry_count,
  }
}

export class TauriLocalSaleQueue implements ILocalSaleQueue {

  async enqueue(sale: Sale): Promise<void> {
    await invoke('save_sale_offline', {
      localId: sale.localId,
      deviceId: sale.deviceId ?? platform.type,
      saleJson: JSON.stringify(sale),
    })
  }

  async listPending(): Promise<SyncQueueItem[]> {
    const rows = await invoke<RustSyncQueueItem[]>('get_pending_sync_items')
    return rows.map(fromRust)
  }

  async markCompleted(queueId: string, recordId: string): Promise<void> {
    await invoke('mark_sync_item_completed', { queueId, recordId })
  }

  async markFailed(queueId: string, error: string): Promise<void> {
    await invoke('mark_sync_item_failed', { queueId, error })
  }
}
