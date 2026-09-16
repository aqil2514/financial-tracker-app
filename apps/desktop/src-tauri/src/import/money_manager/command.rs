use std::path::PathBuf;

use rusqlite::Connection;
use serde::Serialize;
use tauri::Manager;

use super::plan::build_plan;

#[derive(Serialize)]
pub struct ImportSummary {
    account_groups: usize,
    accounts: usize,
    categories: usize,
    transactions: usize,
    income: usize,
    expense: usize,
    transfer: usize,
    unresolved_accounts: usize,
    unresolved_categories: usize,
    unmatched_transfers: usize,
}

fn app_db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal menemukan app data dir: {e}"))?;
    Ok(dir.join("finance.db"))
}

#[tauri::command]
pub fn import_money_manager(
    app: tauri::AppHandle,
    source_path: String,
    dry_run: bool,
) -> Result<ImportSummary, String> {
    let plan = build_plan(&source_path).map_err(|e| format!("Gagal membaca file backup: {e}"))?;

    let income = plan.transactions.iter().filter(|t| t.type_str == "income").count();
    let expense = plan.transactions.iter().filter(|t| t.type_str == "expense").count();
    let transfer = plan.transactions.iter().filter(|t| t.type_str == "transfer").count();

    let summary = ImportSummary {
        account_groups: plan.account_groups.len(),
        accounts: plan.accounts.len(),
        categories: plan.categories.len(),
        transactions: plan.transactions.len(),
        income,
        expense,
        transfer,
        unresolved_accounts: plan.unresolved_accounts,
        unresolved_categories: plan.unresolved_categories,
        unmatched_transfers: plan.unmatched_transfers,
    };

    if dry_run {
        return Ok(summary);
    }

    let db_path = app_db_path(&app)?;
    let backup_path = db_path.with_extension("db.before-import.bak");
    if db_path.exists() {
        std::fs::copy(&db_path, &backup_path)
            .map_err(|e| format!("Gagal membuat backup database: {e}"))?;
    }

    let mut conn = Connection::open(&db_path)
        .map_err(|e| format!("Gagal membuka database aplikasi: {e}"))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("Gagal memulai transaksi: {e}"))?;

    tx.execute_batch(
        "DELETE FROM transactions;
         DELETE FROM accounts;
         DELETE FROM categories;
         DELETE FROM account_groups;
         DELETE FROM sqlite_sequence WHERE name IN ('transactions','accounts','categories','account_groups');",
    )
    .map_err(|e| format!("Gagal menghapus data lama: {e}"))?;

    {
        let mut stmt = tx
            .prepare("INSERT INTO account_groups (id, name) VALUES (?1, ?2)")
            .map_err(|e| e.to_string())?;
        for g in &plan.account_groups {
            stmt.execute(rusqlite::params![g.id, g.name])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO accounts (id, name, initial_balance, group_id, description)
                 VALUES (?1, ?2, 0, ?3, ?4)",
            )
            .map_err(|e| e.to_string())?;
        for a in &plan.accounts {
            stmt.execute(rusqlite::params![a.id, a.name, a.group_id, a.description])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare("INSERT INTO categories (id, name, type, parent_id) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|e| e.to_string())?;
        for c in &plan.categories {
            stmt.execute(rusqlite::params![c.id, c.name, c.type_str, c.parent_id])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO transactions (type, amount, category_id, account_id, transfer_account_id, note, date)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )
            .map_err(|e| e.to_string())?;
        for t in &plan.transactions {
            stmt.execute(rusqlite::params![
                t.type_str,
                t.amount,
                t.category_id,
                t.account_id,
                t.transfer_account_id,
                t.note,
                t.date
            ])
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| format!("Gagal commit transaksi: {e}"))?;

    Ok(summary)
}
