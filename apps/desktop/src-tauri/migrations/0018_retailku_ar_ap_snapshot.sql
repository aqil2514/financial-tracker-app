-- Snapshot outstanding piutang/utang PER PIHAK Retailku, lihat
-- docs/todos/plan/retailku-cashflow-sync.md bagian "Sync AR/AP —
-- idempotency". get_ar_ap MCP itu snapshot TOTAL SAAT INI (bukan
-- transaksi baru per hari) -- tabel ini menyimpan nilai terakhir yang
-- sudah tersinkron PER PARTY (retailku_party_id) supaya sync berikutnya
-- bisa hitung SELISIH per pihak (piutang baru/pelunasan) dengan benar,
-- bukan cuma bandingkan total gabungan (yang bisa saling menutupi kalau
-- satu pihak melunasi sementara pihak lain berutang baru di periode yang
-- sama). Hasil akhirnya TETAP digabung ke 2 kontak lokal generik
-- ("Piutang Retailku"/"Utang Retailku") saat insert ke debts -- tabel
-- ini murni state internal untuk deteksi selisih, bukan sumber kontak.
CREATE TABLE retailku_ar_ap_snapshot (
    retailku_party_id TEXT PRIMARY KEY,
    party_name TEXT NOT NULL,
    outstanding_receivable REAL NOT NULL DEFAULT 0,
    outstanding_payable REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
