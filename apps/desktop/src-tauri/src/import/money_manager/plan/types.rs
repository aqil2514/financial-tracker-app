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
