mod queries;
mod types;

use rusqlite::Connection;

pub use types::{SourceAsset, SourceCategory, SourceData, SourceGroup, SourceTx};

pub fn load_source(source_path: &str) -> rusqlite::Result<SourceData> {
    let conn = Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;

    Ok(SourceData {
        groups: queries::load_groups(&conn)?,
        assets: queries::load_assets(&conn)?,
        categories: queries::load_categories(&conn)?,
        income_expense: queries::load_income_expense(&conn)?,
        transfer_out: queries::load_transfer_out(&conn)?,
        transfer_in: queries::load_transfer_in(&conn)?,
    })
}
