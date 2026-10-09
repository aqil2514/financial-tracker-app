-- Tambah 'labels', 'transaction_labels', 'category_labels',
-- 'account_labels' ke CHECK constraint `cloud_sync_queue.table_name` --
-- bagian sisi desktop dari docs/todos/plan/general-label.md (label
-- disync ke apps/worker/apps/mcp-server sejak awal).
--
-- Pola PERSIS 0034/0043/0044 (tambah tabel baru ke CHECK): SQLite tidak
-- support "ALTER TABLE ... DROP CONSTRAINT" -- rebuild tabel.
-- `cloud_sync_queue` TIDAK direferensikan FK oleh tabel lain manapun,
-- cukup 1 tabel.

ALTER TABLE cloud_sync_queue RENAME TO cloud_sync_queue_old;

CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (
        table_name IN (
            'transactions', 'accounts', 'account_groups', 'categories',
            'contacts', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'transaction_attachments',
            'labels', 'transaction_labels', 'category_labels', 'account_labels'
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
