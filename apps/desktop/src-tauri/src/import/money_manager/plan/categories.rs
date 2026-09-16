use std::collections::HashMap;

use super::super::source::SourceCategory;
use super::types::PlannedCategory;

pub const ADJUSTMENT_CATEGORY_NAME: &str = "Penyesuaian Saldo";

pub struct MappedCategories {
    pub categories: Vec<PlannedCategory>,
    pub id_by_uid: HashMap<String, i64>,
    pub adjustment_income_id: i64,
    pub adjustment_expense_id: i64,
}

pub fn map_categories(categories: &[SourceCategory]) -> MappedCategories {
    let mut id_by_uid: HashMap<String, i64> = HashMap::new();
    let mut planned: Vec<PlannedCategory> = categories
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let id = (i + 1) as i64;
            id_by_uid.insert(c.uid.clone(), id);
            PlannedCategory {
                id,
                name: c.name.clone(),
                type_str: if c.type_code == 0 { "income" } else { "expense" },
                parent_id: None,
            }
        })
        .collect();

    for (i, c) in categories.iter().enumerate() {
        if let Some(parent_uid) = &c.parent_uid {
            if !parent_uid.is_empty() {
                planned[i].parent_id = id_by_uid.get(parent_uid).copied();
            }
        }
    }

    let adjustment_income_id = planned.len() as i64 + 1;
    planned.push(PlannedCategory {
        id: adjustment_income_id,
        name: ADJUSTMENT_CATEGORY_NAME.to_string(),
        type_str: "income",
        parent_id: None,
    });
    let adjustment_expense_id = adjustment_income_id + 1;
    planned.push(PlannedCategory {
        id: adjustment_expense_id,
        name: ADJUSTMENT_CATEGORY_NAME.to_string(),
        type_str: "expense",
        parent_id: None,
    });

    MappedCategories {
        categories: planned,
        id_by_uid,
        adjustment_income_id,
        adjustment_expense_id,
    }
}
