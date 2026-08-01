// apps/desktop/src-tauri/src/main.rs
// ─────────────────────────────────────────────────────────────
// Thin binary entry point. All real logic lives in lib.rs — see
// that file for why (Tauri v2 convention: lib target enables
// future mobile builds, which need a cdylib, not a binary crate).
// ─────────────────────────────────────────────────────────────

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pazariopos_desktop_lib::run();
}
