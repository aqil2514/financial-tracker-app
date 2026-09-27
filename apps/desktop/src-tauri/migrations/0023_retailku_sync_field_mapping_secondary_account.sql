-- Tambah `secondary_account_id` ke `retailku_sync_field_mapping` — lihat
-- docs/todos/plan/retailku-dynamic-sourcetype-mapping.md (Keputusan
-- terbuka #2). Beberapa `key` (mis. `sourceType: FUND_TRANSFER`) butuh
-- 2 akun lokal (dari+ke), bukan 1 (`local_account_id` saja). Kolom ini
-- NULLABLE — mapping generik existing (1 akun) TIDAK terpengaruh,
-- diisi HANYA oleh key yang butuh akun kedua.
--
-- Untuk FUND_TRANSFER: `local_account_id` = akun asal (`fromAccountId`),
-- `secondary_account_id` = akun tujuan (`toAccountId`) — lihat PoC
-- `fund-transfer-poc/schema.ts`.

ALTER TABLE retailku_sync_field_mapping
    ADD COLUMN secondary_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT;

CREATE INDEX idx_retailku_sync_field_mapping_secondary_account
    ON retailku_sync_field_mapping(secondary_account_id);
