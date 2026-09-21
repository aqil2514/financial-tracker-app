-- Penanda sumber transaksi (manual vs sinkronisasi Retailku), lihat
-- docs/todos/plan/retailku-cashflow-sync.md. `source_ref` = identitas
-- unik dari sisi Retailku untuk cek idempotency sebelum insert:
-- mode ringkas -> tanggal ISO ("2026-09-20"), mode detail -> tanggal +
-- sourceType ("2026-09-20:SALE"). UNIQUE mencegah baris dobel kalau
-- sync jalan ulang untuk source_ref yang sama.
ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'retailku_sync'));
ALTER TABLE transactions ADD COLUMN source_ref TEXT;

CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;
