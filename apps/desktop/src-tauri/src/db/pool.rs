// apps/desktop/src-tauri/src/db/pool.rs
// ─────────────────────────────────────────────────────────────
// SQLite connection pool + schema bootstrap.
// One file per device — lives under the OS app-data directory.
// ─────────────────────────────────────────────────────────────

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::PathBuf;

use crate::error::{AppError, AppResult};

pub async fn init_pool(app_data_dir: PathBuf) -> AppResult<SqlitePool> {
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| AppError::Database(sqlx::Error::Io(e)))?;

    let db_path = app_data_dir.join("pazariopos.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> AppResult<()> {
    // Hand-rolled minimal schema for this slice of the system.
    // In the full project this is replaced by `sqlx migrate!()`
    // pointing at apps/desktop/src-tauri/migrations/*.sql
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sync_queue (
            id          TEXT PRIMARY KEY,
            table_name  TEXT NOT NULL,
            operation   TEXT NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
            record_id   TEXT NOT NULL,
            payload     TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error  TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sales (
            id            TEXT PRIMARY KEY,
            local_id      TEXT NOT NULL UNIQUE,
            server_id     TEXT,
            payload       TEXT NOT NULL,
            sync_status   TEXT NOT NULL DEFAULT 'pending',
            device_id     TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            synced_at     TEXT
        );
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
