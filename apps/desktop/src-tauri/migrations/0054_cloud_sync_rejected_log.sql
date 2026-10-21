-- Gap ditemukan 2026-10-21 (audit konsistensi SQLite lokal vs D1): push
-- yang ditolak Worker (422, status "rejected") TIDAK PERNAH masuk
-- cloud_sync_queue (sengaja, lihat README push-on-write -- retry ulang
-- payload yang sama tidak akan pernah berhasil tanpa data berubah).
-- Akibatnya baris yang "rejected" hilang dari cloud TANPA jejak apa pun
-- di desktop -- satu-satunya cara ketahuan adalah compare manual
-- SQLite vs D1 baris per baris, seperti yang terjadi 2026-10-21 (7
-- transaksi + 2 debts + 2 debt_payments ketahuan hilang, akar masalahnya
-- debt_accounts.direction tidak pernah ter-push).
--
-- Tabel ini murni log observability (BUKAN antrian retry) -- supaya
-- reject tercatat dan bisa dicek dari UI kapan saja, tanpa harus compare
-- manual lagi. Satu baris per (table_name, row_id): reject BERULANG
-- untuk baris yang sama cukup REPLACE entry lama (reason/timestamp
-- terbaru yang relevan, bukan histori penuh).
CREATE TABLE cloud_sync_rejected_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (table_name, row_id)
);
