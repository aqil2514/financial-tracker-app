use serde::Serialize;

use super::super::plan::Plan;

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

pub fn build_summary(plan: &Plan) -> ImportSummary {
    let income = plan.transactions.iter().filter(|t| t.type_str == "income").count();
    let expense = plan.transactions.iter().filter(|t| t.type_str == "expense").count();
    let transfer = plan.transactions.iter().filter(|t| t.type_str == "transfer").count();

    ImportSummary {
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
    }
}
