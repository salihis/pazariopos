// apps/desktop/src-tauri/src/commands/barcode.rs
// ─────────────────────────────────────────────────────────────
// Dev/QA helper: lets the frontend (or a test harness) simulate a
// barcode scan without physical hardware. Emits the exact same
// `barcode-scanned` event that hardware/barcode.rs emits for real
// scans, so the frontend BarcodeService cannot tell the difference.
// ─────────────────────────────────────────────────────────────

use tauri::{AppHandle, Emitter};

use crate::error::AppResult;
use crate::hardware::barcode::{BarcodePayload, BARCODE_EVENT};

#[tauri::command]
pub async fn simulate_barcode_scan(app_handle: AppHandle, value: String) -> AppResult<()> {
    let payload = BarcodePayload {
        value,
        format: "UNKNOWN".to_string(),
        scanned_at: chrono::Utc::now().to_rfc3339(),
        source: "mock".to_string(),
    };

    app_handle
        .emit(BARCODE_EVENT, payload)
        .map_err(|e| crate::error::AppError::SerialPort(e.to_string()))?;

    Ok(())
}

/// Lists serial ports that could plausibly be a barcode scanner.
/// Reuses the same OS port enumeration as the printer module.
#[tauri::command]
pub async fn list_barcode_ports() -> AppResult<Vec<String>> {
    Ok(crate::hardware::serial::RealSerialPort::list_available_ports())
}
