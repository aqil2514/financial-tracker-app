use rusqlite::Connection;

use super::types::{SourceAsset, SourceCategory, SourceGroup, SourceTx};

pub fn load_groups(conn: &Connection) -> rusqlite::Result<Vec<SourceGroup>> {
    let mut groups = Vec::new();
    let mut stmt = conn.prepare("SELECT uid, ACC_GROUP_NAME FROM ASSETGROUP")?;
    let rows = stmt.query_map([], |row| {
        Ok(SourceGroup {
            uid: row.get(0)?,
            name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
        })
    })?;
    for r in rows {
        groups.push(r?);
    }
    Ok(groups)
}

pub fn load_assets(conn: &Connection) -> rusqlite::Result<Vec<SourceAsset>> {
    let mut assets = Vec::new();
    let mut stmt = conn.prepare("SELECT uid, NIC_NAME, groupUid, ZDATA1 FROM ASSETS")?;
    let rows = stmt.query_map([], |row| {
        Ok(SourceAsset {
            uid: row.get(0)?,
            name: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            group_uid: row.get(2)?,
            description: row.get(3)?,
        })
    })?;
    for r in rows {
        assets.push(r?);
    }
    Ok(assets)
}

pub fn load_categories(conn: &Connection) -> rusqlite::Result<Vec<SourceCategory>> {
    let mut categories = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT uid, NAME, TYPE, pUid FROM ZCATEGORY WHERE NAME IS NOT NULL AND NAME != ''",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SourceCategory {
            uid: row.get(0)?,
            name: row.get(1)?,
            type_code: row.get(2)?,
            parent_uid: row.get(3)?,
        })
    })?;
    for r in rows {
        categories.push(r?);
    }
    Ok(categories)
}

pub fn load_income_expense(conn: &Connection) -> rusqlite::Result<Vec<SourceTx>> {
    let mut rows_out = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT DO_TYPE, assetUid, ctgUid, ZCONTENT, ZDATE, ZMONEY
         FROM INOUTCOME WHERE DO_TYPE IN ('0', '1', '7', '8')",
    )?;
    let rows = stmt.query_map([], |row| {
        let do_type_str: String = row.get(0)?;
        let amount_str: String = row.get(5)?;
        Ok(SourceTx {
            do_type: do_type_str.parse().unwrap_or(-1),
            asset_uid: row.get(1)?,
            ctg_uid: row.get(2)?,
            content: row.get(3)?,
            date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
            amount: amount_str.parse().unwrap_or(0.0),
            to_asset_uid: None,
        })
    })?;
    for r in rows {
        rows_out.push(r?);
    }
    Ok(rows_out)
}

pub fn load_transfer_out(conn: &Connection) -> rusqlite::Result<Vec<SourceTx>> {
    let mut rows_out = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT DO_TYPE, assetUid, toAssetUid, ZCONTENT, ZDATE, ZMONEY
         FROM INOUTCOME WHERE DO_TYPE = '3'",
    )?;
    let rows = stmt.query_map([], |row| {
        let amount_str: String = row.get(5)?;
        Ok(SourceTx {
            do_type: 3,
            asset_uid: row.get(1)?,
            to_asset_uid: row.get(2)?,
            ctg_uid: None,
            content: row.get(3)?,
            date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
            amount: amount_str.parse().unwrap_or(0.0),
        })
    })?;
    for r in rows {
        rows_out.push(r?);
    }
    Ok(rows_out)
}

pub fn load_transfer_in(conn: &Connection) -> rusqlite::Result<Vec<SourceTx>> {
    let mut rows_out = Vec::new();
    let mut stmt = conn.prepare(
        "SELECT DO_TYPE, assetUid, toAssetUid, ZCONTENT, ZDATE, ZMONEY
         FROM INOUTCOME WHERE DO_TYPE = '4'",
    )?;
    let rows = stmt.query_map([], |row| {
        let amount_str: String = row.get(5)?;
        Ok(SourceTx {
            do_type: 4,
            asset_uid: row.get(1)?,
            to_asset_uid: row.get(2)?,
            ctg_uid: None,
            content: row.get(3)?,
            date_epoch_ms: row.get::<_, String>(4)?.parse().unwrap_or(0),
            amount: amount_str.parse().unwrap_or(0.0),
        })
    })?;
    for r in rows {
        rows_out.push(r?);
    }
    Ok(rows_out)
}
