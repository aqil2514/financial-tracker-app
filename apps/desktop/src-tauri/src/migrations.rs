use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "seed_default_categories",
            sql: include_str!("../migrations/0002_seed_categories.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "accounts",
            sql: include_str!("../migrations/0003_accounts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "allow_transfer_type",
            sql: include_str!("../migrations/0004_allow_transfer_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "account_groups",
            sql: include_str!("../migrations/0005_account_groups.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "category_parent",
            sql: include_str!("../migrations/0006_category_parent.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "transfer_account_index",
            sql: include_str!("../migrations/0007_transfer_account_index.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "active_flag",
            sql: include_str!("../migrations/0008_active_flag.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "enforce_fk_set_null",
            sql: include_str!("../migrations/0009_enforce_fk_set_null.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "transaction_attachments",
            sql: include_str!("../migrations/0010_transaction_attachments.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "transaction_description",
            sql: include_str!("../migrations/0011_transaction_description.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "debts",
            sql: include_str!("../migrations/0012_debts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "account_type",
            sql: include_str!("../migrations/0013_account_type.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "transaction_contact",
            sql: include_str!("../migrations/0014_transaction_contact.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "account_color",
            sql: include_str!("../migrations/0015_account_color.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "retailku_account_mapping",
            sql: include_str!("../migrations/0016_retailku_account_mapping.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "transaction_source",
            sql: include_str!("../migrations/0017_transaction_source.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "retailku_ar_ap_snapshot",
            sql: include_str!("../migrations/0018_retailku_ar_ap_snapshot.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "transaction_note_not_null",
            sql: include_str!("../migrations/0019_transaction_note_not_null.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "retailku_sync_field_mapping",
            sql: include_str!("../migrations/0020_retailku_sync_field_mapping.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "drop_retailku_ar_ap_snapshot",
            sql: include_str!("../migrations/0021_drop_retailku_ar_ap_snapshot.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "fix_transactions_old_fk",
            sql: include_str!("../migrations/0022_fix_transactions_old_fk.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "retailku_sync_field_mapping_secondary_account",
            sql: include_str!("../migrations/0023_retailku_sync_field_mapping_secondary_account.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "retailku_sync_field_mapping_extra_fields",
            sql: include_str!("../migrations/0024_retailku_sync_field_mapping_extra_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "debts_source_ref",
            sql: include_str!("../migrations/0025_debts_source_ref.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "debt_payments_source_ref",
            sql: include_str!("../migrations/0026_debt_payments_source_ref.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "uuid_primary_keys",
            sql: include_str!("../migrations/0027_uuid_primary_keys.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 28,
            description: "cloud_sync_columns",
            sql: include_str!("../migrations/0028_cloud_sync_columns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 29,
            description: "cloud_sync_queue",
            sql: include_str!("../migrations/0029_cloud_sync_queue.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 30,
            description: "cloud_sync_queue_payload",
            sql: include_str!("../migrations/0030_cloud_sync_queue_payload.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 31,
            description: "seed_default_debt_account",
            sql: include_str!("../migrations/0031_seed_default_debt_account.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 32,
            description: "backfill_null_transaction_ids",
            sql: include_str!("../migrations/0032_backfill_null_transaction_ids.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 33,
            description: "backfill_direct_debt_transactions",
            sql: include_str!("../migrations/0033_backfill_direct_debt_transactions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 34,
            description: "cloud_sync_queue_debts",
            sql: include_str!("../migrations/0034_cloud_sync_queue_debts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 35,
            description: "account_type_investment",
            sql: include_str!("../migrations/0035_account_type_investment.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 36,
            description: "investment_accounts_and_purchases",
            sql: include_str!("../migrations/0036_investment_accounts_and_purchases.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // Menjalankan SELURUH migration lewat rusqlite, mereplikasi konteks
    // eksekusi sqlx yang sesungguhnya (satu transaksi + PRAGMA
    // foreign_keys = ON) — bukan sekadar menjalankan file .sql apa
    // adanya lewat sqlite3 CLI (autocommit per statement), yang pernah
    // memberi hasil false-positive di migrasi 0009 (lihat
    // docs/rules/sqlite-copy-and-rename-migration.md). Test ini TIDAK
    // menjamin migration bebas bug data (lihat rule di atas: row count
    // yang tetap benar tidak berarti data tidak ter-SET-NULL secara
    // tidak sengaja), tapi menjamin seluruh urutan migration bisa
    // dijalankan dari nol tanpa error SQL/FK di CI, sebelum ketahuan
    // di device pengguna nyata.
    fn run_all_migrations(conn: &rusqlite::Connection) {
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("gagal mengaktifkan foreign_keys");

        for migration in get() {
            conn.execute_batch(migration.sql).unwrap_or_else(|e| {
                panic!(
                    "migration {} ({}) gagal: {e}",
                    migration.version, migration.description
                )
            });
        }
    }

    #[test]
    fn semua_migration_berhasil_dijalankan_dari_nol() {
        let conn = rusqlite::Connection::open_in_memory().expect("gagal buka koneksi in-memory");
        run_all_migrations(&conn);

        let violations: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check()", [], |row| {
                row.get(0)
            })
            .expect("gagal menjalankan foreign_key_check");
        assert_eq!(violations, 0, "ada foreign key yang melanggar setelah migrasi");
    }

    #[test]
    fn skema_akhir_punya_tabel_dan_kolom_inti() {
        let conn = rusqlite::Connection::open_in_memory().expect("gagal buka koneksi in-memory");
        run_all_migrations(&conn);

        // Daftar minimal — bukan audit skema lengkap, cukup penjaga
        // supaya migration berikutnya yang typo nama tabel/kolom inti
        // ketahuan di CI, bukan di device pengguna.
        let expected_tables = [
            "accounts",
            "account_groups",
            "categories",
            "transactions",
            "transaction_attachments",
            "debts",
            "debt_payments",
            "contacts",
        ];
        for table in expected_tables {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap_or_else(|e| panic!("gagal cek tabel {table}: {e}"));
            assert_eq!(count, 1, "tabel {table} tidak ditemukan setelah migrasi");
        }

        let accounts_has_is_active: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('accounts') WHERE name = 'is_active'",
                [],
                |row| row.get(0),
            )
            .expect("gagal cek kolom accounts.is_active");
        assert_eq!(accounts_has_is_active, 1, "accounts.is_active tidak ditemukan");

        let transactions_account_id_is_uuid: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('transactions') WHERE name = 'account_id' AND type = 'TEXT'",
                [],
                |row| row.get(0),
            )
            .expect("gagal cek tipe transactions.account_id");
        assert_eq!(
            transactions_account_id_is_uuid, 1,
            "transactions.account_id diharapkan TEXT (UUID) setelah migrasi 0027"
        );
    }

    // Reproduksi bug nyata migrasi 0022 (lihat
    // docs/rules/sqlite-copy-and-rename-migration.md, poin #3): migrasi
    // yang me-rebuild sebuah tabel TAPI lupa ikut me-rebuild tabel lain
    // yang FK-nya menunjuk ke situ akan LOLOS test "migration jalan
    // tanpa error" maupun cek skema (CREATE TABLE-nya tetap valid) —
    // baru ketahuan saat ada INSERT baru ke tabel yang FK-nya basi,
    // gagal dengan "no such table: main.<tabel>_old". Test ini sengaja
    // INSERT ke seluruh rantai FK (accounts -> transactions ->
    // transaction_attachments/debts -> debt_payments) supaya regresi
    // sejenis 0022 ketahuan di CI.
    #[test]
    fn insert_baru_di_seluruh_rantai_fk_tidak_gagal() {
        let conn = rusqlite::Connection::open_in_memory().expect("gagal buka koneksi in-memory");
        run_all_migrations(&conn);

        conn.execute_batch(
            "
            INSERT INTO accounts (id, name, account_type) VALUES ('acc-1', 'Kas Test', 'cash');
            INSERT INTO accounts (id, name, account_type) VALUES ('acc-debt-1', 'Utang Test', 'debt');
            INSERT INTO categories (id, name, type) VALUES ('cat-1', 'Kategori Test', 'expense');
            INSERT INTO transactions (id, type, amount, category_id, account_id, note, date)
                VALUES ('tx-1', 'expense', 1000, 'cat-1', 'acc-1', 'catatan', '2026-01-01');
            INSERT INTO transaction_attachments (id, transaction_id, file_path)
                VALUES ('att-1', 'tx-1', '/tmp/foo.png');
            INSERT INTO contacts (id, name) VALUES ('contact-1', 'Kontak Test');
            INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
                VALUES ('debt-1', 'receivable', 'contact-1', 500, 'acc-debt-1', 'tx-1', '2026-01-01');
            INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
                VALUES ('pay-1', 'debt-1', 100, 'acc-1', 'tx-1', '2026-01-02');
            ",
        )
        .expect("insert ke rantai FK accounts->transactions->debts->debt_payments gagal");
    }

    // Migrasi 0035/0036: 'investment' harus diterima di CHECK
    // accounts.account_type, dan investment_accounts/investment_purchases
    // harus bisa di-insert dgn FK ke accounts/transactions -- regresi
    // sejenis 0022 kalau salah satu tabel dalam rantai FK accounts lupa
    // ikut di-rebuild saat CHECK diubah.
    #[test]
    fn insert_akun_investment_dan_riwayat_pembelian_tidak_gagal() {
        let conn = rusqlite::Connection::open_in_memory().expect("gagal buka koneksi in-memory");
        run_all_migrations(&conn);

        conn.execute_batch(
            "
            INSERT INTO accounts (id, name, account_type) VALUES ('acc-inv-1', 'Reksadana Test', 'investment');
            INSERT INTO investment_accounts (account_id, unit_label, current_price_per_unit)
                VALUES ('acc-inv-1', 'unit', 1500.0);
            INSERT INTO accounts (id, name, account_type) VALUES ('acc-cash-1', 'Kas Test', 'cash');
            INSERT INTO transactions (id, type, amount, account_id, transfer_account_id, note, date)
                VALUES ('tx-inv-1', 'transfer', 100000, 'acc-cash-1', 'acc-inv-1', 'beli reksadana', '2026-01-01');
            INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
                VALUES ('ip-1', 'acc-inv-1', 'tx-inv-1', 66.67, 1500.0, '2026-01-01', 'pending');
            ",
        )
        .expect("insert akun investment + investment_purchases gagal");
    }
}
