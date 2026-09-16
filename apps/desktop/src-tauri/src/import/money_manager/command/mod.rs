mod backup;
mod summary;
mod writer;

use rusqlite::Connection;

pub use summary::ImportSummary;

use super::plan::build_plan;
use backup::{app_db_path, backup_database};
use summary::build_summary;
use writer::write_plan;

#[tauri::command]
pub fn import_money_manager(
    app: tauri::AppHandle,
    source_path: String,
    dry_run: bool,
) -> Result<ImportSummary, String> {
    let plan = build_plan(&source_path).map_err(|e| format!("Gagal membaca file backup: {e}"))?;
    let summary = build_summary(&plan);

    if dry_run {
        return Ok(summary);
    }

    let db_path = app_db_path(&app)?;
    backup_database(&db_path)?;

    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Gagal membuka database aplikasi: {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Gagal memulai transaksi: {e}"))?;

    write_plan(&tx, &plan)?;

    tx.commit().map_err(|e| format!("Gagal commit transaksi: {e}"))?;

    Ok(summary)
}
