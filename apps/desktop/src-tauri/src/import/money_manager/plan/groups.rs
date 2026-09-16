use std::collections::HashMap;

use super::super::source::SourceGroup;
use super::types::PlannedAccountGroup;

pub struct MappedGroups {
    pub account_groups: Vec<PlannedAccountGroup>,
    pub id_by_uid: HashMap<String, i64>,
}

pub fn map_account_groups(groups: &[SourceGroup]) -> MappedGroups {
    let mut id_by_uid: HashMap<String, i64> = HashMap::new();
    let account_groups: Vec<PlannedAccountGroup> = groups
        .iter()
        .enumerate()
        .map(|(i, g)| {
            let id = (i + 1) as i64;
            id_by_uid.insert(g.uid.clone(), id);
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
