-- Idempotency utk sync AR/AP baru (lihat handover 2026-09-28 sesi 2 &
-- 3): baris `debts` hasil sync AR/AP sekarang bisa `transaction_id:
-- NULL` (piutang/utang dagang murni tanpa sisi kas), jadi idempotency
-- lama yang cek `transactions.source_ref` tidak berlaku lagi. Kolom
-- ini mengikuti pola PERSIS `transactions.source`/`source_ref`
-- (0017_transaction_source.sql).

ALTER TABLE debts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'retailku_sync'));
ALTER TABLE debts ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX idx_debts_source_ref
    ON debts(source, source_ref)
    WHERE source_ref IS NOT NULL;
