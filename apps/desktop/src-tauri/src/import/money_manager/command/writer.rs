use rusqlite::Transaction;

use super::super::plan::Plan;

pub fn clear_existing_data(tx: &Transaction) -> Result<(), String> {
    tx.execute_batch(
        "DELETE FROM transactions;
         DELETE FROM accounts;
         DELETE FROM categories;
         DELETE FROM account_groups;
         DELETE FROM sqlite_sequence WHERE name IN ('transactions','accounts','categories','account_groups');",
    )
    .map_err(|e| format!("Gagal menghapus data lama: {e}"))
}

pub fn write_plan(tx: &Transaction, plan: &Plan) -> Result<(), String> {
    clear_existing_data(tx)?;

    {
        let mut stmt = tx
            .prepare("INSERT INTO account_groups (id, name) VALUES (?1, ?2)")
            .map_err(|e| e.to_string())?;
        for g in &plan.account_groups {
            stmt.execute(rusqlite::params![g.id, g.name])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO accounts (id, name, initial_balance, group_id, description)
                 VALUES (?1, ?2, 0, ?3, ?4)",
            )
            .map_err(|e| e.to_string())?;
        for a in &plan.accounts {
            stmt.execute(rusqlite::params![a.id, a.name, a.group_id, a.description])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare("INSERT INTO categories (id, name, type, parent_id) VALUES (?1, ?2, ?3, ?4)")
            .map_err(|e| e.to_string())?;
        for c in &plan.categories {
            stmt.execute(rusqlite::params![c.id, c.name, c.type_str, c.parent_id])
                .map_err(|e| e.to_string())?;
        }
    }

    {
        let mut stmt = tx
            .prepare(
                "INSERT INTO transactions (type, amount, category_id, account_id, transfer_account_id, note, date)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )
            .map_err(|e| e.to_string())?;
        for t in &plan.transactions {
            stmt.execute(rusqlite::params![
                t.type_str,
                t.amount,
                t.category_id,
                t.account_id,
                t.transfer_account_id,
                t.note,
                t.date
            ])
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
