-- Penanda sumber transaksi (manual vs sinkronisasi Retailku), lihat
-- docs/todos/plan/retailku-cashflow-sync.md. `source_ref` = identitas
-- unik dari sisi Retailku untuk cek idempotency sebelum insert:
-- mode ringkas -> "tanggal:accountId" ("2026-09-20:accId"), mode detail ->
-- "tanggal:accountId:sourceType" ("2026-09-20:accId:SALE"). UNIQUE
-- mencegah baris dobel kalau sync jalan ulang untuk source_ref yang
-- SAMA PERSIS. Idempotency check di sync-cashflow.ts (`isPeriodSynced`)
-- TIDAK exact-match — dia LIKE-prefix "tanggal:accountId" supaya ganti
-- mode untuk periode yang sama tetap terdeteksi sebagai sudah tersync
-- (bug ditemukan live 2026-09-22: beda mode -> source_ref beda -> lolos
-- exact-match -> insert dobel).
ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'retailku_sync'));
ALTER TABLE transactions ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;
