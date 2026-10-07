-- Tambah 'investment_accounts', 'investment_purchases', 'investment_sales'
-- ke CHECK constraint `cloud_sync_queue.table_name` -- gap yang kelewat
-- di migrasi 0042 (kolom cloud-sync ketiga tabel investment ditambah,
-- tapi CHECK constraint antrian retry LUPA diperluas juga). Ditemukan
-- lewat smoke test nyata (Tahap 5 docs/todos/plan/investment-sync.md):
-- push "accounts" sukses tapi push "investment_accounts" gagal (lihat
-- migrasi lain di sesi ini) -> enqueueUpsertPush("investment_accounts", ...)
-- MELEMPAR error CHECK constraint, bukan masuk antrian seperti seharusnya.
--
-- Pola PERSIS 0034 (tambah 'debts'/'debt_payments'): SQLite tidak support
-- "ALTER TABLE ... DROP CONSTRAINT" -- rebuild tabel (rename lama ->
-- create baru dgn CHECK baru -> copy data -> drop lama). `cloud_sync_queue`
-- TIDAK direferensikan FK oleh tabel lain manapun, cukup 1 tabel.

ALTER TABLE cloud_sync_queue RENAME TO cloud_sync_queue_old;

CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (
        table_name IN (
            'transactions', 'accounts', 'account_groups', 'categories',
            'contacts', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales'
        )
    ),
    row_id TEXT NOT NULL,
    op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload TEXT,
    UNIQUE (table_name, row_id)
);

INSERT INTO cloud_sync_queue (id, table_name, row_id, op, attempts, last_error, created_at, payload)
    SELECT id, table_name, row_id, op, attempts, last_error, created_at, payload
    FROM cloud_sync_queue_old;

DROP TABLE cloud_sync_queue_old;
