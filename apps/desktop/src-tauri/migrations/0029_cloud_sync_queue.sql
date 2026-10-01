-- Tahap 6 dari docs/todos/plan/mcp-server-cloud-mirror.md: antrian
-- retry utk push on-write yang gagal (offline/request gagal saat
-- terjadi) -- supaya perubahan tidak hilang senyap, dicoba ulang nanti
-- saat online lagi.
--
-- Isi antrian cuma referensi {table_name, row_id, op} -- BUKAN payload
-- penuh (keputusan sadar, 2026-10-01): saat retry, baca ULANG row
-- terbaru dari SQLite lokal lalu push, supaya kalau row itu diedit lagi
-- sebelum retry sempat jalan, yang terkirim data TERBARU (bukan
-- snapshot basi). `op = 'delete'` tidak baca ulang row (sudah
-- hard-deleted lokal), cuma kirim DELETE dgn `row_id` ke Worker.
--
-- `attempts`/`last_error` murni observability (belum ada UI yang
-- menampilkannya, disiapkan dari awal supaya tidak perlu migrasi lagi
-- nanti kalau dibutuhkan).

CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (table_name IN ('transactions', 'accounts', 'account_groups', 'categories', 'contacts')),
    row_id TEXT NOT NULL,
    op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Satu baris per (table_name, row_id) cukup -- kalau row yang sama
    -- gagal push lagi sebelum retry lama sempat jalan, cukup REPLACE
    -- entry lama (op baru menang, mis. upsert lalu delete sebelum
    -- sempat retry -> cukup simpan delete).
    UNIQUE (table_name, row_id)
);
