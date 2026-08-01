// apps/desktop/src-tauri/build.rs
// ─────────────────────────────────────────────────────────────
// Required by Tauri v2. Without this, `tauri::generate_context!()`
// in lib.rs fails with "OUT_DIR env var is not set" — Cargo only
// sets OUT_DIR when a crate has a build script, and Tauri's context
// macro reads generated files (parsed tauri.conf.json, embedded
// icons, etc.) from that directory at compile time.
// ─────────────────────────────────────────────────────────────

fn main() {
    tauri_build::build()
}
