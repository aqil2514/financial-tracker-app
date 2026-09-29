pub struct PlannedAccountGroup {
    pub id: String,
    pub name: String,
}

pub struct PlannedAccount {
    pub id: String,
    pub name: String,
    pub group_id: Option<String>,
    pub description: Option<String>,
}

pub struct PlannedCategory {
    pub id: String,
    pub name: String,
    pub type_str: &'static str,
    pub parent_id: Option<String>,
}

pub struct PlannedTransaction {
    pub id: String,
    pub type_str: &'static str,
    pub amount: f64,
    pub category_id: Option<String>,
    pub account_id: String,
    pub transfer_account_id: Option<String>,
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
