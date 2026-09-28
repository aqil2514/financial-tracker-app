-- Idempotency utk sync pelunasan AR/AP (docs/todos/plan/
-- retailku-ar-ap-negative-amount-settlement.md) — baris `debt_payments`
-- hasil sync SALE_PAYMENT butuh source_ref sendiri (journalItemId baris
-- kas SALE_PAYMENT, BEDA dari source_ref piutang aslinya di `debts`)
-- supaya sync berulang tidak insert cicilan duplikat. Pola PERSIS
-- `debts.source`/`source_ref` (0025_debts_source_ref.sql).

ALTER TABLE debt_payments ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'retailku_sync'));
ALTER TABLE debt_payments ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX idx_debt_payments_source_ref
    ON debt_payments(source, source_ref)
    WHERE source_ref IS NOT NULL;
