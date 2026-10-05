-- Tambah 'debts' dan 'debt_payments' ke CHECK constraint
-- `cloud_sync_queue.table_name` -- bagian dari fix duplikasi debts/
-- debt_payments (source-based ownership), lihat
-- docs/todos/plan/fix-debts-duplikasi-sync.md &
-- apps/desktop/docs/todos/plan/fix-debts-duplikasi-sync.md.
--
-- SQLite tidak support "ALTER TABLE ... DROP CONSTRAINT" -- rebuild
-- tabel (pola sama 0009/0022/0027): rename lama -> create baru dgn
-- CHECK baru -> copy data -> drop lama. `cloud_sync_queue` TIDAK
-- direferensikan FK oleh tabel lain manapun (beda dari rantai di
-- 0027), jadi tidak perlu urutan dependency rumit -- cukup 1 tabel.

ALTER TABLE cloud_sync_queue RENAME TO cloud_sync_queue_old;

CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (
        table_name IN (
            'transactions', 'accounts', 'account_groups', 'categories',
            'contacts', 'debts', 'debt_payments'
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
