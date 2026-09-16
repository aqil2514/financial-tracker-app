use rusqlite::Connection;

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

pub fn load_source(source_path: &str) -> rusqlite::Result<SourceData> {
    let conn = Connection::open_with_flags(source_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;

    let mut groups = Vec::new();
    {
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
    }

    let mut assets = Vec::new();
    {
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
    }

    let mut categories = Vec::new();
    {
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
    }

    let map_tx_row = |row: &rusqlite::Row| -> rusqlite::Result<SourceTx> {
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
    };

    let mut income_expense = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT DO_TYPE, assetUid, ctgUid, ZCONTENT, ZDATE, ZMONEY
             FROM INOUTCOME WHERE DO_TYPE IN ('0', '1', '7', '8')",
        )?;
        let rows = stmt.query_map([], map_tx_row)?;
        for r in rows {
            income_expense.push(r?);
        }
    }

    let mut transfer_out = Vec::new();
    {
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
            transfer_out.push(r?);
        }
    }

    let mut transfer_in = Vec::new();
    {
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
            transfer_in.push(r?);
        }
    }

    Ok(SourceData {
        groups,
        assets,
        categories,
        income_expense,
        transfer_out,
        transfer_in,
    })
}
