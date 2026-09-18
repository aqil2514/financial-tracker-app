use std::path::PathBuf;

use tauri::Manager;

pub fn app_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal menemukan app data dir: {e}"))?;
    // Harus sinkron dengan db_url di lib.rs — debug build pakai file
    // terpisah supaya import/backup tidak pernah menyentuh finance.db
    // production saat development.
    let file_name = if cfg!(debug_assertions) {
        "finance.dev.db"
    } else {
        "finance.db"
    };
    Ok(dir.join(file_name))
}

pub fn backup_database(db_path: &PathBuf) -> Result<(), String> {
    if !db_path.exists() {
        return Ok(());
    }

    let backup_path = db_path.with_extension("db.before-import.bak");
    std::fs::copy(db_path, &backup_path)
        .map_err(|e| format!("Gagal membuat backup database: {e}"))?;
    Ok(())
}
