-- Tambah 'forex_accounts', 'forex_purchases', 'forex_sales' ke CHECK constraint
-- `cloud_sync_queue.table_name` -- tahap sync desktop dari
-- docs/todos/plan/forex-sync.md. Tanpa ini enqueue retry push valas yang gagal
-- akan throw CHECK constraint violation (pelajaran dari 0055: tabel baru yang
-- masuk QueueableTable di TypeScript wajib ikut di CHECK ini).
--
-- Pola PERSIS 0034/0043/0044/0046/0055: SQLite tidak support ALTER TABLE ...
-- DROP CONSTRAINT, jadi rebuild tabel. `cloud_sync_queue` TIDAK direferensikan
-- FK oleh tabel lain manapun, cukup 1 tabel.
--
-- 'category_periods' ikut ditambahkan: sudah ada di QueueableTable TypeScript tapi
-- terlewat di CHECK sejak 0055 (kelas bug yang sama), jadi enqueue retry-nya akan
-- gagal. Memperluas CHECK tidak mengubah baris yang ada.

ALTER TABLE cloud_sync_queue RENAME TO cloud_sync_queue_old;

CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (
        table_name IN (
            'transactions', 'accounts', 'account_groups', 'categories',
            'contacts', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'transaction_attachments',
            'labels', 'transaction_labels', 'category_labels', 'account_labels',
            'third_party_funds', 'category_periods',
            'forex_accounts', 'forex_purchases', 'forex_sales'
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
