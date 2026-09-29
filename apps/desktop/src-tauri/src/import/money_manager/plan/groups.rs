use std::collections::HashMap;

use uuid::Uuid;

use super::super::source::SourceGroup;
use super::types::PlannedAccountGroup;

pub struct MappedGroups {
    pub account_groups: Vec<PlannedAccountGroup>,
    pub id_by_uid: HashMap<String, String>,
}

pub fn map_account_groups(groups: &[SourceGroup]) -> MappedGroups {
    let mut id_by_uid: HashMap<String, String> = HashMap::new();
    let account_groups: Vec<PlannedAccountGroup> = groups
        .iter()
        .map(|g| {
            let id = Uuid::now_v7().to_string();
            id_by_uid.insert(g.uid.clone(), id.clone());
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

    MappedGroups {
        account_groups,
        id_by_uid,
    }
}
