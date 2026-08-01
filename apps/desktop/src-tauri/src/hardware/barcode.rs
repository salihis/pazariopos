// apps/desktop/src-tauri/src/hardware/barcode.rs
// ─────────────────────────────────────────────────────────────
// Desktop-side barcode capture.
//
// Most USB barcode scanners present themselves to the OS as a
// standard HID keyboard ("keyboard wedge" mode) — the same events
// the web BarcodeService listens for via `keydown`. For desktop we
// ALSO support scanners wired over a serial/COM port (common on
// industrial fixed-mount scanners), which is what this module
// demonstrates: a background thread reads line-delimited barcode
// strings from a serial port and emits them as a Tauri event.
//
// A MockBarcodeSource is included so the full event pipeline
// (serial → parse → emit → frontend `listen()`) can be exercised
// without physical hardware attached, matching the pattern used
// in hardware/serial.rs for the printer.
// ─────────────────────────────────────────────────────────────

use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub const BARCODE_EVENT: &str = "barcode-scanned";

#[derive(Debug, Clone, Serialize)]
pub struct BarcodePayload {
    pub value: String,
    pub format: String,     // best-effort guess; real decoding depends on scanner model
    pub scanned_at: String, // ISO-8601, set at emit time
    pub source: String,     // "serial" | "hid" | "mock"
}

/// Starts a background thread that listens for barcode scans and emits
/// them to the frontend via `app_handle.emit(BARCODE_EVENT, payload)`.
///
/// `port_name`:
///   - `None` or `"mock"` → runs the mock generator (dev/demo mode)
///   - Some(name)         → attempts to open the named serial port
pub fn start_barcode_listener(app_handle: AppHandle, port_name: Option<String>) {
    std::thread::spawn(move || match port_name.as_deref() {
        None | Some("mock") => run_mock_source(app_handle),
        Some(name) => run_serial_source(app_handle, name),
    });
}

// ── Real: serial-attached scanner ───────────────────────────

fn run_serial_source(app_handle: AppHandle, port_name: &str) {
    let port = serialport::new(port_name, 9600)
        .timeout(Duration::from_millis(500))
        .open();

    let port = match port {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[barcode] could not open '{port_name}': {e}. Falling back to mock.");
            return run_mock_source(app_handle);
        }
    };

    let mut reader = BufReader::new(port);
    let mut line = String::new();

    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => continue,          // timeout, no data yet
            Ok(_) => {
                let value = line.trim().to_string();
                if !value.is_empty() {
                    emit_scan(&app_handle, &value, "serial");
                }
            }
            Err(_) => continue,         // read timeout is expected; keep polling
        }
    }
}

// ── Mock: for dev machines with no scanner attached ─────────

fn run_mock_source(_app_handle: AppHandle) {
    println!("[barcode] running in MOCK mode — no physical scanner detected");
    // Intentionally idle: in mock mode barcodes are injected via the
    // `simulate_barcode_scan` command (see commands/barcode.rs) instead
    // of being generated automatically, so QA can trigger specific
    // values on demand from the UI during development.
    loop {
        std::thread::sleep(Duration::from_secs(3600));
    }
}

fn emit_scan(app_handle: &AppHandle, value: &str, source: &str) {
    let payload = BarcodePayload {
        value: value.to_string(),
        format: guess_format(value),
        scanned_at: chrono::Utc::now().to_rfc3339(),
        source: source.to_string(),
    };

    if let Err(e) = app_handle.emit(BARCODE_EVENT, payload) {
        eprintln!("[barcode] failed to emit event: {e}");
    }
}

/// Very rough format guess based on length/charset. Real projects
/// should decode this from the scanner's symbology prefix if supported.
fn guess_format(value: &str) -> String {
    match value.len() {
        13 if value.chars().all(|c| c.is_ascii_digit()) => "EAN_13".to_string(),
        8  if value.chars().all(|c| c.is_ascii_digit()) => "EAN_8".to_string(),
        12 if value.chars().all(|c| c.is_ascii_digit()) => "UPC_A".to_string(),
        _ => "UNKNOWN".to_string(),
    }
}
