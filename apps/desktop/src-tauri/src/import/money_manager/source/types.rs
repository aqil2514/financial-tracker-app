pub struct SourceGroup {
    pub uid: String,
    pub name: String,
}

pub struct SourceAsset {
    pub uid: String,
    pub name: String,
    pub group_uid: Option<String>,
    pub description: Option<String>,
}

pub struct SourceCategory {
    pub uid: String,
    pub name: String,
    pub type_code: i64,
    pub parent_uid: Option<String>,
}

pub struct SourceTx {
    pub do_type: i64,
    pub asset_uid: Option<String>,
    pub to_asset_uid: Option<String>,
    pub ctg_uid: Option<String>,
    pub content: Option<String>,
    pub date_epoch_ms: i64,
    pub amount: f64,
}

pub struct SourceData {
    pub groups: Vec<SourceGroup>,
    pub assets: Vec<SourceAsset>,
    pub categories: Vec<SourceCategory>,
    pub income_expense: Vec<SourceTx>,
    pub transfer_out: Vec<SourceTx>,
    pub transfer_in: Vec<SourceTx>,
}
