-- Menggantikan `retailku_account_mapping` (0016) dengan tabel yang lebih
-- umum, lihat docs/todos/plan/retailku-sync-field-mapping.md. Alasan:
-- `retailku_account_mapping` cuma urus SATU pertanyaan ("akun Retailku X
-- masuk ke akun lokal mana") — itu KASUS KHUSUS dari pertanyaan yang lebih
-- umum tiap mode sync ("baris jenis INI, field non-fakta apa yang
-- dipakai, masuk akun mana"). Tabel baru menyatukan keduanya per KEY
-- (bukan dua tabel dengan tanggung jawab tumpang tindih).
--
-- `key` mencakup identitas akun DI DALAMNYA (lihat bentuk key di dokumen
-- plan: summary = "summary:<inflow|outflow>:<retailkuAccountId>", detail
-- = "detail:<retailkuAccountId>:<sourceType>:<inflow|outflow>") — jadi
-- SATU baris tabel ini menjawab BAIK "akun tujuan" (WAJIB, `local_
-- account_id NOT NULL`) MAUPUN "field non-fakta" (OPSIONAL, nullable,
-- fallback ke default kalau NULL — lihat compute-cashflow-sync.ts).
--
-- `retailku_account_id`/`retailku_account_code`/`retailku_account_name`
-- DIPERTAHANKAN sebagai kolom terpisah (bukan di-parse dari `key`) --
-- dipakai UI untuk tampilan human-readable TANPA perlu parse string key
-- atau panggil ulang MCP, sama seperti alasan `retailku_account_mapping`
-- menyimpan code/name sebagai snapshot (lihat 0016).
--
-- Migrasi data lama: SETIAP baris `retailku_account_mapping` yang ada
-- sekarang dibawa jadi DUA baris key baru (`summary:inflow:...` DAN
-- `summary:outflow:...`) dengan `local_account_id` yang SAMA persis --
-- user yang sudah setup mapping akun TIDAK kehilangan konfigurasinya,
-- field non-fakta (note/category_id/description) dibiarkan NULL
-- (fallback ke default template lama, TIDAK breaking). Mode "detail"
-- SENGAJA TIDAK di-backfill dari data lama (retailku_account_mapping
-- tidak punya informasi sourceType) -- baris detail baru akan muncul
-- otomatis saat sync detail berjalan dan key belum ada mapping-nya
-- (di-skip dengan aman kalau local_account_id belum diisi user, sama
-- seperti mekanisme unmapped-account sekarang).

CREATE TABLE retailku_sync_field_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    retailku_account_id TEXT NOT NULL,
    retailku_account_code TEXT NOT NULL,
    retailku_account_name TEXT NOT NULL,
    local_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    note TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_retailku_sync_field_mapping_local_account
    ON retailku_sync_field_mapping(local_account_id);
CREATE INDEX idx_retailku_sync_field_mapping_category
    ON retailku_sync_field_mapping(category_id);

INSERT INTO retailku_sync_field_mapping (
    key, retailku_account_id, retailku_account_code, retailku_account_name, local_account_id
)
SELECT
    'summary:inflow:' || retailku_account_id,
    retailku_account_id, retailku_account_code, retailku_account_name, local_account_id
FROM retailku_account_mapping
UNION ALL
SELECT
    'summary:outflow:' || retailku_account_id,
    retailku_account_id, retailku_account_code, retailku_account_name, local_account_id
FROM retailku_account_mapping;

DROP TABLE retailku_account_mapping;
