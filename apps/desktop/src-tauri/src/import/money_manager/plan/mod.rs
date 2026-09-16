mod accounts;
mod categories;
mod groups;
mod transactions;
mod types;

pub use types::Plan;

use super::source::load_source;
use accounts::map_accounts;
use categories::map_categories;
use groups::map_account_groups;
use transactions::{map_income_expense, map_transfers};

pub fn build_plan(source_path: &str) -> rusqlite::Result<Plan> {
    let source = load_source(source_path)?;

    let mapped_groups = map_account_groups(&source.groups);
    let mapped_accounts = map_accounts(&source.assets, &mapped_groups.id_by_uid);
    let mapped_categories = map_categories(&source.categories);

    let income_expense = map_income_expense(
        &source.income_expense,
        &mapped_accounts.id_by_uid,
        &mapped_categories.id_by_uid,
        mapped_categories.adjustment_income_id,
        mapped_categories.adjustment_expense_id,
    );

    let transfers = map_transfers(
        &source.transfer_out,
        &source.transfer_in,
        &mapped_accounts.id_by_uid,
    );

    let mut transactions = income_expense.transactions;
    transactions.extend(transfers.transactions);
    transactions.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(Plan {
        account_groups: mapped_groups.account_groups,
        accounts: mapped_accounts.accounts,
        categories: mapped_categories.categories,
        transactions,
        unresolved_accounts: income_expense.unresolved_accounts + transfers.unresolved_accounts,
        unresolved_categories: income_expense.unresolved_categories,
        unmatched_transfers: transfers.unmatched_transfers,
    })
}
