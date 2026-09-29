use std::collections::HashMap;

use uuid::Uuid;

use super::super::source::SourceAsset;
use super::types::PlannedAccount;

pub struct MappedAccounts {
    pub accounts: Vec<PlannedAccount>,
    pub id_by_uid: HashMap<String, String>,
}

pub fn map_accounts(assets: &[SourceAsset], group_id_by_uid: &HashMap<String, String>) -> MappedAccounts {
    let mut id_by_uid: HashMap<String, String> = HashMap::new();
    let accounts: Vec<PlannedAccount> = assets
        .iter()
        .map(|a| {
            let id = Uuid::now_v7().to_string();
            id_by_uid.insert(a.uid.clone(), id.clone());
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
                    .and_then(|uid| group_id_by_uid.get(uid).cloned()),
                description: a.description.clone().filter(|s| !s.is_empty()),
            }
        })
        .collect();

    MappedAccounts {
        accounts,
        id_by_uid,
    }
}
