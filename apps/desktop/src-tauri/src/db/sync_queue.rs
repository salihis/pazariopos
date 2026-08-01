// apps/desktop/src-tauri/src/db/sync_queue.rs
// ─────────────────────────────────────────────────────────────
// Data access for the local sync_queue + sales tables.
// Called by commands/sales.rs, which is invoked from the TS
// offline branch of useSaleStore when the device has no connectivity.
// ─────────────────────────────────────────────────────────────

use serde::Serialize;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::error::AppResult;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SyncQueueRow {
    pub id: String,
    pub table_name: String,
    pub operation: String,
    pub record_id: String,
    pub payload: String,
    pub created_at: String,
    pub retry_count: i64,
    pub last_error: Option<String>,
}

/// Persists a sale locally and enqueues it for later synchronization.
/// Both writes happen in a single transaction so a crash mid-save can
/// never leave a `sales` row without a matching queue entry (or vice versa).
pub async fn save_sale_offline(
    pool: &SqlitePool,
    local_id: &str,
    device_id: &str,
    sale_json: &str,
) -> AppResult<()> {
    let mut tx = pool.begin().await?;
    let row_id = Uuid::new_v4().to_string();
    let queue_id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"INSERT INTO sales (id, local_id, payload, sync_status, device_id)
           VALUES (?, ?, ?, 'pending', ?)"#,
    )
    .bind(&row_id)
    .bind(local_id)
    .bind(sale_json)
    .bind(device_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"INSERT INTO sync_queue (id, table_name, operation, record_id, payload)
           VALUES (?, 'sales', 'INSERT', ?, ?)"#,
    )
    .bind(&queue_id)
    .bind(local_id)
    .bind(sale_json)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Returns all queue entries awaiting sync, oldest first.
pub async fn fetch_pending(pool: &SqlitePool) -> AppResult<Vec<SyncQueueRow>> {
    let rows = sqlx::query_as::<_, SyncQueueRow>(
        r#"SELECT id, table_name, operation, record_id, payload, created_at, retry_count, last_error
           FROM sync_queue
           ORDER BY created_at ASC"#,
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Removes a queue entry once the server has confirmed persistence,
/// and flips the originating sale's sync_status to 'synced'.
pub async fn mark_synced(pool: &SqlitePool, queue_id: &str, record_id: &str) -> AppResult<()> {
    let mut tx = pool.begin().await?;

    sqlx::query("DELETE FROM sync_queue WHERE id = ?")
        .bind(queue_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        "UPDATE sales SET sync_status = 'synced', synced_at = datetime('now') WHERE local_id = ?",
    )
    .bind(record_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Increments retry_count and stores the last error after a failed sync attempt.
pub async fn mark_failed(pool: &SqlitePool, queue_id: &str, error: &str) -> AppResult<()> {
    sqlx::query(
        "UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?",
    )
    .bind(error)
    .bind(queue_id)
    .execute(pool)
    .await?;

    Ok(())
}
