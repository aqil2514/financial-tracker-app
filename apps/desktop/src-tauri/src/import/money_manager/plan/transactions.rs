use std::collections::HashMap;

use super::super::source::SourceTx;
use super::types::PlannedTransaction;

pub fn epoch_ms_to_iso_minute(epoch_ms: i64) -> String {
    use std::time::{Duration, UNIX_EPOCH};

    let dt = UNIX_EPOCH + Duration::from_millis(epoch_ms.max(0) as u64);
    let datetime: chrono::DateTime<chrono::Local> = chrono::DateTime::<chrono::Utc>::from(dt).into();
    datetime.format("%Y-%m-%dT%H:%M").to_string()
}

pub struct MappedIncomeExpense {
    pub transactions: Vec<PlannedTransaction>,
    pub unresolved_accounts: usize,
    pub unresolved_categories: usize,
}

pub fn map_income_expense(
    rows: &[SourceTx],
    account_id_by_uid: &HashMap<String, i64>,
    category_id_by_uid: &HashMap<String, i64>,
    adjustment_income_id: i64,
    adjustment_expense_id: i64,
) -> MappedIncomeExpense {
    let mut transactions = Vec::new();
    let mut unresolved_accounts = 0usize;
    let mut unresolved_categories = 0usize;

    for row in rows {
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

    MappedIncomeExpense {
        transactions,
        unresolved_accounts,
        unresolved_categories,
    }
}

pub struct MappedTransfers {
    pub transactions: Vec<PlannedTransaction>,
    pub unresolved_accounts: usize,
    pub unmatched_transfers: usize,
}

pub fn map_transfers(
    transfer_out: &[SourceTx],
    transfer_in: &[SourceTx],
    account_id_by_uid: &HashMap<String, i64>,
) -> MappedTransfers {
    let mut transfer_in_index: HashMap<(String, String, i64, String), &SourceTx> = HashMap::new();
    for row in transfer_in {
        let key = (
            row.asset_uid.clone().unwrap_or_default(),
            row.to_asset_uid.clone().unwrap_or_default(),
            row.date_epoch_ms,
            format!("{:.2}", row.amount),
        );
        transfer_in_index.insert(key, row);
    }

    let mut transactions = Vec::new();
    let mut unresolved_accounts = 0usize;
    let mut unmatched_transfers = 0usize;

    for out in transfer_out {
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

    MappedTransfers {
        transactions,
        unresolved_accounts,
        unmatched_transfers,
    }
}
