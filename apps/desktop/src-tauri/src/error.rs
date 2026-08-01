// apps/desktop/src-tauri/src/error.rs
// ─────────────────────────────────────────────────────────────
// Central error type. Tauri commands must return `Result<T, E>`
// where E: Serialize, so every error path funnels through here
// and is serialized as a plain string message to the frontend.
// ─────────────────────────────────────────────────────────────

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
// `Printer`, `Sync`, and `NotFound` aren't constructed anywhere yet:
//   • Printer  — commands/printer.rs deliberately converts failures into
//     `Ok(PrintResultDto::fail(..))` instead of `Err(..)`, so a print
//     failure reports gracefully to the frontend instead of rejecting
//     the whole invoke() call. Kept for a future command that needs a
//     hard failure (e.g. printer configuration validation).
//   • Sync / NotFound — reserved for the sync-conflict and lookup-miss
//     cases described in ARCHITECTURE.md §4a, which land once the
//     desktop-side sync engine (not just the queue) is implemented.
// Real dead code would be a bug; this is a deliberately-staged error
// surface, so we suppress the lint rather than delete variants we know
// we're about to need.
#[allow(dead_code)]
pub enum AppError {
    #[error("printer error: {0}")]
    Printer(String),

    #[error("serial port error: {0}")]
    SerialPort(String),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("sync error: {0}")]
    Sync(String),

    #[error("not found: {0}")]
    NotFound(String),
}

// Tauri requires command errors to implement Serialize so they can
// cross the IPC boundary as JSON and be caught in the TS `invoke()` call.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
