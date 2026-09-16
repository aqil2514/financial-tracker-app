use std::collections::HashMap;

use super::super::source::SourceAsset;
use super::types::PlannedAccount;

pub struct MappedAccounts {
    pub accounts: Vec<PlannedAccount>,
    pub id_by_uid: HashMap<String, i64>,
}

pub fn map_accounts(assets: &[SourceAsset], group_id_by_uid: &HashMap<String, i64>) -> MappedAccounts {
    let mut id_by_uid: HashMap<String, i64> = HashMap::new();
    let accounts: Vec<PlannedAccount> = assets
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let id = (i + 1) as i64;
            id_by_uid.insert(a.uid.clone(), id);
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

    MappedAccounts {
        accounts,
        id_by_uid,
    }
}
