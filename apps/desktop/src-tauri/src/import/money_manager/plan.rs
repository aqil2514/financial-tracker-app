use std::collections::HashMap;

use super::source::{load_source, SourceTx};

pub struct PlannedAccountGroup {
    pub id: i64,
    pub name: String,
}

pub struct PlannedAccount {
    pub id: i64,
    pub name: String,
    pub group_id: Option<i64>,
    pub description: Option<String>,
}

pub struct PlannedCategory {
    pub id: i64,
    pub name: String,
    pub type_str: &'static str,
    pub parent_id: Option<i64>,
}

pub struct PlannedTransaction {
    pub type_str: &'static str,
    pub amount: f64,
    pub category_id: Option<i64>,
    pub account_id: i64,
    pub transfer_account_id: Option<i64>,
    pub note: Option<String>,
    pub date: String,
}

pub struct Plan {
    pub account_groups: Vec<PlannedAccountGroup>,
    pub accounts: Vec<PlannedAccount>,
    pub categories: Vec<PlannedCategory>,
    pub transactions: Vec<PlannedTransaction>,
    pub unresolved_accounts: usize,
    pub unresolved_categories: usize,
    pub unmatched_transfers: usize,
}

const ADJUSTMENT_CATEGORY_NAME: &str = "Penyesuaian Saldo";

fn epoch_ms_to_iso_minute(epoch_ms: i64) -> String {
    use std::time::{Duration, UNIX_EPOCH};

    let dt = UNIX_EPOCH + Duration::from_millis(epoch_ms.max(0) as u64);
    let datetime: chrono::DateTime<chrono::Local> = chrono::DateTime::<chrono::Utc>::from(dt).into();
    datetime.format("%Y-%m-%dT%H:%M").to_string()
}

pub fn build_plan(source_path: &str) -> rusqlite::Result<Plan> {
    let source = load_source(source_path)?;

    let mut group_id_by_uid: HashMap<String, i64> = HashMap::new();
    let account_groups: Vec<PlannedAccountGroup> = source
        .groups
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
    let accounts: Vec<PlannedAccount> = source
        .assets
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
    let mut categories_planned: Vec<PlannedCategory> = source
        .categories
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

    for (i, c) in source.categories.iter().enumerate() {
        if let Some(parent_uid) = &c.parent_uid {
            if !parent_uid.is_empty() {
                categories_planned[i].parent_id = category_id_by_uid.get(parent_uid).copied();
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

    for row in &source.income_expense {
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
    for row in &source.transfer_in {
        let key = (
            row.asset_uid.clone().unwrap_or_default(),
            row.to_asset_uid.clone().unwrap_or_default(),
            row.date_epoch_ms,
            format!("{:.2}", row.amount),
        );
        transfer_in_index.insert(key, row);
    }

    let mut unmatched_transfers = 0usize;
    for out in &source.transfer_out {
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
