use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

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

struct SourceGroup {
    uid: String,
    name: String,
}

struct SourceAsset {
    uid: String,
    name: String,
    group_uid: Option<String>,
    description: Option<String>,
}

struct SourceCategory {
    uid: String,
    name: String,
    type_code: i64,
    parent_uid: Option<String>,
}

struct SourceTx {
    do_type: i64,
    asset_uid: Option<String>,
    to_asset_uid: Option<String>,
    ctg_uid: Option<String>,
    content: Option<String>,
    date_epoch_ms: i64,
    amount: f64,
}

struct PlannedAccountGroup {
    id: i64,
    name: String,
}

struct PlannedAccount {
    id: i64,
    name: String,
    group_id: Option<i64>,
    description: Option<String>,
}

struct PlannedCategory {
    id: i64,
    name: String,
    type_str: &'static str,
    parent_id: Option<i64>,
}

struct PlannedTransaction {
    type_str: &'static str,
    amount: f64,
    category_id: Option<i64>,
    account_id: i64,
    transfer_account_id: Option<i64>,
    note: Option<String>,
    date: String,
}

struct Plan {
    account_groups: Vec<PlannedAccountGroup>,
    accounts: Vec<PlannedAccount>,
    categories: Vec<PlannedCategory>,
    transactions: Vec<PlannedTransaction>,
    unresolved_accounts: usize,
    unresolved_categories: usize,
    unmatched_transfers: usize,
}

const ADJUSTMENT_CATEGORY_NAME: &str = "Penyesuaian Saldo";

fn epoch_ms_to_iso_minute(epoch_ms: i64) -> String {
    use std::time::{Duration, UNIX_EPOCH};

    let dt = UNIX_EPOCH + Duration::from_millis(epoch_ms.max(0) as u64);
    let datetime: chrono::DateTime<chrono::Local> = chrono::DateTime::<chrono::Utc>::from(dt).into();
    datetime.format("%Y-%m-%dT%H:%M").to_string()
}

fn load_source(source_path: &str) -> rusqlite::Result<(
    Vec<SourceGroup>,
    Vec<SourceAsset>,
    Vec<SourceCategory>,
    Vec<SourceTx>,
    Vec<SourceTx>,
    Vec<SourceTx>,
)> {
    let conn = Connection::open_with_flags(
        source_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )?;

    let mut groups = Vec::new();
    {
        let mut stmt = conn.prepare("SELECT uid, ACC_GROUP_NAME FROM ASSETGROUP")?;
        let rows = stmt.query_map([], |row| {
            Ok(SourceGroup {
                uid: row.get(0)?,
                name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            })
        })?;
        for r in rows {
            groups.push(r?);
        }
    }

    let mut assets = Vec::new();
    {
        let mut stmt =
            conn.prepare("SELECT uid, NIC_NAME, groupUid, ZDATA1 FROM ASSETS")?;
        let rows = stmt.query_map([], |row| {
            Ok(SourceAsset {
                uid: row.get(0)?,
                name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                group_uid: row.get(2)?,
                description: row.get(3)?,
            })
        })?;
        for r in rows {
            assets.push(r?);
        }
    }

    let mut categories = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT uid, NAME, TYPE, pUid FROM ZCATEGORY WHERE NAME IS NOT NULL AND NAME != ''",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SourceCategory {
                uid: row.get(0)?,
                name: row.get(1)?,
                type_code: row.get(2)?,
                parent_uid: row.get(3)?,
            })
        })?;
        for r in rows {
            categories.push(r?);
        }
    }

    let map_tx_row = |row: &rusqlite::Row| -> rusqlite::Result<SourceTx> {
        let do_type_str: String = row.get(0)?;
        let amount_str: String = row.get(5)?;
        Ok(SourceTx {
            do_type: do_type_str.parse().unwrap_or(-1),
            asset_uid: row.get(1)?,
            ctg_uid: row.get(2)?,
            content: row.get(3)?,
            date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
            amount: amount_str.parse().unwrap_or(0.0),
            to_asset_uid: None,
        })
    };

    let mut income_expense = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DO_TYPE, assetUid, ctgUid, ZCONTENT, ZDATE, ZMONEY
             FROM INOUTCOME WHERE DO_TYPE IN ('0', '1', '7', '8')",
        )?;
        let rows = stmt.query_map([], map_tx_row)?;
        for r in rows {
            income_expense.push(r?);
        }
    }

    let mut transfer_out = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DO_TYPE, assetUid, toAssetUid, ZCONTENT, ZDATE, ZMONEY
             FROM INOUTCOME WHERE DO_TYPE = '3'",
        )?;
        let rows = stmt.query_map([], |row| {
            let amount_str: String = row.get(5)?;
            Ok(SourceTx {
                do_type: 3,
                asset_uid: row.get(1)?,
                to_asset_uid: row.get(2)?,
                ctg_uid: None,
                content: row.get(3)?,
                date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
                amount: amount_str.parse().unwrap_or(0.0),
            })
        })?;
        for r in rows {
            transfer_out.push(r?);
        }
    }

    let mut transfer_in = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DO_TYPE, assetUid, toAssetUid, ZCONTENT, ZDATE, ZMONEY
             FROM INOUTCOME WHERE DO_TYPE = '4'",
        )?;
        let rows = stmt.query_map([], |row| {
            let amount_str: String = row.get(5)?;
            Ok(SourceTx {
                do_type: 4,
                asset_uid: row.get(1)?,
                to_asset_uid: row.get(2)?,
                ctg_uid: None,
                content: row.get(3)?,
                date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
                amount: amount_str.parse().unwrap_or(0.0),
            })
        })?;
        for r in rows {
            transfer_in.push(r?);
        }
    }

    Ok((groups, assets, categories, income_expense, transfer_out, transfer_in))
}

fn build_plan(source_path: &str) -> rusqlite::Result<Plan> {
    let (groups, assets, categories, income_expense, transfer_out, transfer_in) =
        load_source(source_path)?;

    let mut group_id_by_uid: HashMap<String, i64> = HashMap::new();
    let account_groups: Vec<PlannedAccountGroup> = groups
        .iter()
        .enumerate()
        .map(|(i, g)| {
            let id = (i + 1) as i64;
            group_id_by_uid.insert(g.uid.clone(), id);
            PlannedAccountGroup {
                id,
                name: if g.name.is_empty() {
                    "Tanpa Nama".to_string()
                } else {
                    g.name.clone()
                },
            }
        })
        .collect();

    let mut account_id_by_uid: HashMap<String, i64> = HashMap::new();
    let accounts: Vec<PlannedAccount> = assets
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let id = (i + 1) as i64;
            account_id_by_uid.insert(a.uid.clone(), id);
            PlannedAccount {
                id,
                name: if a.name.is_empty() {
                    "Tanpa Nama".to_string()
                } else {
                    a.name.clone()
                },
                group_id: a
                    .group_uid
                    .as_ref()
                    .and_then(|uid| group_id_by_uid.get(uid).copied()),
                description: a.description.clone().filter(|s| !s.is_empty()),
            }
        })
        .collect();

    let mut category_id_by_uid: HashMap<String, i64> = HashMap::new();
    let mut categories_planned: Vec<PlannedCategory> = categories
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let id = (i + 1) as i64;
            category_id_by_uid.insert(c.uid.clone(), id);
            PlannedCategory {
                id,
                name: c.name.clone(),
                type_str: if c.type_code == 0 { "income" } else { "expense" },
                parent_id: None,
            }
        })
        .collect();

    for (i, c) in categories.iter().enumerate() {
        if let Some(parent_uid) = &c.parent_uid {
            if !parent_uid.is_empty() {
                categories_planned[i].parent_id =
                    category_id_by_uid.get(parent_uid).copied();
            }
        }
    }

    let adjustment_income_id = categories_planned.len() as i64 + 1;
    categories_planned.push(PlannedCategory {
        id: adjustment_income_id,
        name: ADJUSTMENT_CATEGORY_NAME.to_string(),
        type_str: "income",
        parent_id: None,
    });
    let adjustment_expense_id = adjustment_income_id + 1;
    categories_planned.push(PlannedCategory {
        id: adjustment_expense_id,
        name: ADJUSTMENT_CATEGORY_NAME.to_string(),
        type_str: "expense",
        parent_id: None,
    });

    let mut transactions = Vec::new();
    let mut unresolved_accounts = 0usize;
    let mut unresolved_categories = 0usize;

    for row in &income_expense {
        let account_id = match row.asset_uid.as_ref().and_then(|u| account_id_by_uid.get(u)) {
            Some(id) => *id,
            None => {
                unresolved_accounts += 1;
                continue;
            }
        };

        let is_income = row.do_type == 0 || row.do_type == 7;
        let type_str = if is_income { "income" } else { "expense" };

        let category_id = match row.ctg_uid.as_deref() {
            Some("-4") => Some(if is_income {
                adjustment_income_id
            } else {
                adjustment_expense_id
            }),
            Some(uid) if !uid.is_empty() => {
                let resolved = category_id_by_uid.get(uid).copied();
                if resolved.is_none() {
                    unresolved_categories += 1;
                }
                resolved
            }
            _ => None,
        };

        transactions.push(PlannedTransaction {
            type_str,
            amount: row.amount.abs(),
            category_id,
            account_id,
            transfer_account_id: None,
            note: row.content.clone().filter(|s| !s.is_empty()),
            date: epoch_ms_to_iso_minute(row.date_epoch_ms),
        });
    }

    let mut transfer_in_index: HashMap<(String, String, i64, String), &SourceTx> = HashMap::new();
    for row in &transfer_in {
        let key = (
            row.asset_uid.clone().unwrap_or_default(),
            row.to_asset_uid.clone().unwrap_or_default(),
            row.date_epoch_ms,
            format!("{:.2}", row.amount),
        );
        transfer_in_index.insert(key, row);
    }

    let mut unmatched_transfers = 0usize;
    for out in &transfer_out {
        let key = (
            out.to_asset_uid.clone().unwrap_or_default(),
            out.asset_uid.clone().unwrap_or_default(),
            out.date_epoch_ms,
            format!("{:.2}", out.amount),
        );

        if transfer_in_index.get(&key).is_none() {
            unmatched_transfers += 1;
            continue;
        }

        let account_id = out.asset_uid.as_ref().and_then(|u| account_id_by_uid.get(u).copied());
        let transfer_account_id = out
            .to_asset_uid
            .as_ref()
            .and_then(|u| account_id_by_uid.get(u).copied());

        let (account_id, transfer_account_id) = match (account_id, transfer_account_id) {
            (Some(a), Some(b)) => (a, b),
            _ => {
                unresolved_accounts += 1;
                continue;
            }
        };

        transactions.push(PlannedTransaction {
            type_str: "transfer",
            amount: out.amount.abs(),
            category_id: None,
            account_id,
            transfer_account_id: Some(transfer_account_id),
            note: out.content.clone().filter(|s| !s.is_empty()),
            date: epoch_ms_to_iso_minute(out.date_epoch_ms),
        });
    }

    transactions.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(Plan {
        account_groups,
        accounts,
        categories: categories_planned,
        transactions,
        unresolved_accounts,
        unresolved_categories,
        unmatched_transfers,
    })
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
