-- Persistensi mapping akun Retailku (isPaymentMethod=true) -> akun
-- lokal (account_type='cash'), lihat
-- docs/todos/plan/retailku-account-mapping.md. `retailku_account_id`
-- adalah UUID stabil dari Retailku (tidak berubah walau code/name
-- akun di sana di-rename) -- code/name di sini cuma snapshot untuk
-- ditampilkan tanpa perlu panggil MCP ulang.
--
-- ON DELETE RESTRICT: mencegah akun lokal terhapus selama masih
-- dipakai sebagai tujuan mapping, supaya integrasi tidak diam-diam
-- rusak saat user beres-beres akun.
CREATE TABLE retailku_account_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    retailku_account_id TEXT NOT NULL UNIQUE,
    retailku_account_code TEXT NOT NULL,
    retailku_account_name TEXT NOT NULL,
    local_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_retailku_account_mapping_local_account
    ON retailku_account_mapping(local_account_id);
