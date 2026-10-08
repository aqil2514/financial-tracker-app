-- Tabel baru utk lampiran transaksi (foto struk dkk) tersimpan di
-- Cloudflare R2 -- Tahap skema dari docs/todos/plan/attachment-r2-sync.md.
--
-- BEDA dari skema LOKAL desktop (apps/desktop/src-tauri/migrations/
-- 0010_transaction_attachments.sql, TIDAK diubah oleh migrasi ini sama
-- sekali):
-- - TIDAK ADA `file_path` -- path lokal Windows/PC device-specific,
--   tidak bermakna direplikasi ke cloud. Device mana pun (PC lama, PC
--   baru, nanti apps/mobile) translate `id` row ini -> bytes file
--   lewat endpoint Worker, lalu simpan ke path lokalnya sendiri.
-- - `r2_key` -- satu-satunya penunjuk lokasi object R2 sesungguhnya,
--   dibuat Worker saat upload (format `{transaction_id}/{id}.{ext}`),
--   BUKAN sama dengan `id` (memuat info ekstensi file + pengelompokan
--   per transaksi yang `id` sendiri tidak punya).
-- - `content_type`/`size_bytes` -- baru, tidak ada di skema lokal.
--   `content_type` wajib disimpan supaya endpoint GET /attachments/:id
--   bisa kirim header Content-Type benar saat serve dari R2 (desktop
--   lokal tidak butuh ini krn baca by file extension langsung dari
--   disk). `size_bytes` utk cek kuota/estimasi biaya tanpa query R2.
-- - `updated_at`/`deleted_at`/`sync_source` -- identik pola SEMUA tabel
--   lain sejak 0001_initial.sql (LWW + soft-delete, Worker SELALU isi
--   eksplisit, tanpa trigger DB).
--
-- `id` WAJIB UUIDv7 dari caller (bukan server-generate), SAMA PERSIS
-- nilai `id` baris attachment ybs di SQLite lokal desktop -- diverifikasi
-- `transaction_attachments.id` PC sudah UUIDv7 sejak migrasi lokal
-- 0027_uuid_primary_keys.sql (cek manual 2026-10-08 thd finance.db
-- production: format version-7 terkonfirmasi). Inilah kunci penghubung
-- lintas device, BUKAN r2_key.
--
-- CASCADE DELETE di sini cuma hapus ROW D1 saat transaksi induk dihapus
-- -- TIDAK ikut hapus object fisik R2 (D1 tidak bisa trigger side-effect
-- ke binding R2). Hard-delete object R2 WAJIB ditangani eksplisit di
-- modul Worker (endpoint DELETE /attachments/:id DAN saat cascade dari
-- hapus transaksi), bukan di level skema.

CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
CREATE UNIQUE INDEX idx_transaction_attachments_r2_key ON transaction_attachments(r2_key);
