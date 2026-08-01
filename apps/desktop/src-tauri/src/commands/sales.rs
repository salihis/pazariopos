// apps/desktop/src-tauri/src/commands/sales.rs
// ─────────────────────────────────────────────────────────────
// Bridges useSaleStore's offline branch to the local SQLite queue.
// Called only when NetworkMonitor reports the device is offline.
// ─────────────────────────────────────────────────────────────

use serde::Serialize;
use tauri::State;

use crate::db::sync_queue::{self, SyncQueueRow};
use crate::error::AppResult;
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct SyncQueueItemDto {
    pub id: String,
    pub table_name: String,
    pub operation: String,
    pub record_id: String,
    pub payload: String,
    pub created_at: String,
    pub retry_count: i64,
}

impl From<SyncQueueRow> for SyncQueueItemDto {
    fn from(r: SyncQueueRow) -> Self {
        Self {
            id: r.id,
            table_name: r.table_name,
            operation: r.operation,
            record_id: r.record_id,
            payload: r.payload,
            created_at: r.created_at,
            retry_count: r.retry_count,
        }
    }
}

/// Persists a sale to local SQLite and enqueues it for sync.
/// `sale_json` is the already-serialized `Sale` object from the frontend —
/// stored as an opaque JSON blob so the Rust layer never has to keep its
/// struct definition in lockstep with every frontend field change.
#[tauri::command]
pub async fn save_sale_offline(
    state: State<'_, AppState>,
    local_id: String,
    device_id: String,
    sale_json: String,
) -> AppResult<()> {
    sync_queue::save_sale_offline(&state.db, &local_id, &device_id, &sale_json).await
}

/// Returns everything currently queued for sync — polled by the frontend's
/// NetworkMonitor reconnect handler to drive the auto-sync loop.
#[tauri::command]
pub async fn get_pending_sync_items(
    state: State<'_, AppState>,
) -> AppResult<Vec<SyncQueueItemDto>> {
    let rows = sync_queue::fetch_pending(&state.db).await?;
    Ok(rows.into_iter().map(SyncQueueItemDto::from).collect())
}

/// Called by the frontend after the server confirms it persisted a queued item.
#[tauri::command]
pub async fn mark_sync_item_completed(
    state: State<'_, AppState>,
    queue_id: String,
    record_id: String,
) -> AppResult<()> {
    sync_queue::mark_synced(&state.db, &queue_id, &record_id).await
}

/// Called by the frontend when the server rejects a queued sync item.
#[tauri::command]
pub async fn mark_sync_item_failed(
    state: State<'_, AppState>,
    queue_id: String,
    error: String,
) -> AppResult<()> {
    sync_queue::mark_failed(&state.db, &queue_id, &error).await
}
