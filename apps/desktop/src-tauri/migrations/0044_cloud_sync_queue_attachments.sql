-- Tambah 'transaction_attachments' ke CHECK constraint
-- `cloud_sync_queue.table_name` -- bagian sisi desktop dari
-- apps/worker/docs/todos/plan/attachment-r2-sync.md (push/pull lampiran
-- transaksi via R2). Retry upsert attachment baca ulang `file_path` dari
-- SQLite lokal lalu `read_attachment_bytes` (Rust) -- sama prinsipnya
-- dgn tabel lain yang baca ulang kolom SQL, hanya sumbernya file disk
-- bukan kolom.
--
-- Pola PERSIS 0034/0043 (tambah tabel baru ke CHECK): SQLite tidak
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
            'transaction_attachments'
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
