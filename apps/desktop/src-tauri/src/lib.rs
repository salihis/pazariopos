// apps/desktop/src-tauri/src/lib.rs
// ─────────────────────────────────────────────────────────────
// Application logic lives here (not main.rs) per the standard
// Tauri v2 convention: Cargo.toml declares a `[lib]` target
// (`pazariopos_desktop_lib`) so the same setup/command-registration
// code can be reused by both the desktop binary (main.rs) and, if
// added later, mobile entry points (which require a cdylib, not a
// binary crate). See main.rs for the 3-line desktop entry point.
//
// Responsibilities:
//   1. Initialize the local SQLite pool (db::pool).
//   2. Share it as managed state (AppState) for all commands.
//   3. Register every #[tauri::command] the frontend can invoke.
//   4. Spawn the barcode background listener on startup.
// ─────────────────────────────────────────────────────────────

mod commands;
mod db;
mod error;
mod hardware;

use sqlx::SqlitePool;
use tauri::Manager;

/// Shared application state, accessible from any #[tauri::command]
/// via `State<'_, AppState>`.
pub struct AppState {
    pub db: SqlitePool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // SQLite lives under the OS-standard app-data directory,
            // e.g. %APPDATA%/pazariopos-desktop on Windows,
            //      ~/Library/Application Support/pazariopos-desktop on macOS,
            //      ~/.local/share/pazariopos-desktop on Linux.
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            // Tauri's setup hook is sync; block_on bridges into our async pool init.
            let db = tauri::async_runtime::block_on(db::pool::init_pool(app_data_dir))
                .expect("failed to initialize local database");

            app.manage(AppState { db });

            // Barcode scanner listener runs for the lifetime of the app.
            // `None` = mock mode by default; wire this up to a settings
            // value (e.g. saved COM port) once hardware is configured.
            let barcode_port = std::env::var("POS_BARCODE_PORT").ok();
            hardware::barcode::start_barcode_listener(app_handle, barcode_port);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Printer
            commands::printer::print_receipt,
            commands::printer::print_report,
            commands::printer::test_print,
            commands::printer::list_printers,
            // Barcode
            commands::barcode::simulate_barcode_scan,
            commands::barcode::list_barcode_ports,
            // Offline sales / sync queue
            commands::sales::save_sale_offline,
            commands::sales::get_pending_sync_items,
            commands::sales::mark_sync_item_completed,
            commands::sales::mark_sync_item_failed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running pazariopos-desktop");
}
