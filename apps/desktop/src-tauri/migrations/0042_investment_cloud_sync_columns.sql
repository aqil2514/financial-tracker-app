-- Kolom pendukung sync dua-arah PC <-> Cloudflare D1 utk 3 tabel
-- investment (investment_accounts/investment_purchases/investment_sales)
-- -- langkah Tahap 3 dari docs/todos/plan/investment-sync.md, pola PERSIS
-- migrasi 0028_cloud_sync_columns.sql (7 tabel non-investment) yang
-- sudah lebih dulu melakukan ini.
--
-- Ketiga tabel ini BELUM pernah disentuh sync sama sekali (investment
-- desktop-only sejak awal) -- kolom ini baru ditambahkan SEKARANG setelah
-- Worker (apps/worker schema/0002_account_type_investment.sql) sudah
-- lebih dulu py kolom ini sejak awal dibuatnya tabel tsb di D1.
--
-- CATATAN PENTING: `investment_accounts.updated_at` SUDAH ADA sejak
-- migrasi 0037 (bukan kolom LWW -- dipakai fitur BISNIS "indikator
-- staleness nilai pasar", `InvestmentPlStats`/`formatDistanceToNow`, dan
-- diisi manual via `datetime('now')` di use-update-market-value.ts +
-- use-update-account.ts tiap kali `unit_label`/`current_market_value`
-- berubah). Semantiknya KEBETULAN cocok dipakai juga sbg LWW ("kapan
-- baris ini terakhir berubah") -- TIDAK ditambahkan ulang di sini (akan
-- gagal "duplicate column"), cukup `deleted_at`/`sync_source` yang baru.
-- Trigger auto-refresh di bawah aman ditambahkan sbg pelengkap (kedua
-- tempat yang sudah ada mengisi updated_at manual via `datetime('now')`
-- SENDIRI, jadi `WHEN NEW.updated_at = OLD.updated_at` di trigger akan
-- FALSE di situ -- trigger baru jalan utk UPDATE lain yang lupa isi
-- manual, tidak dobel-isi).
--
-- CATATAN TEKNIS sama persis 0028: SQLite menolak ADD COLUMN dgn default
-- non-konstan pada tabel berisi data -- updated_at (investment_purchases/
-- investment_sales SAJA, investment_accounts sudah py kolom ini) ditambah
-- TANPA default dulu, di-backfill via UPDATE terpisah.

ALTER TABLE investment_accounts ADD COLUMN deleted_at TEXT;
ALTER TABLE investment_accounts ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE investment_purchases ADD COLUMN updated_at TEXT;
ALTER TABLE investment_purchases ADD COLUMN deleted_at TEXT;
ALTER TABLE investment_purchases ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE investment_sales ADD COLUMN updated_at TEXT;
ALTER TABLE investment_sales ADD COLUMN deleted_at TEXT;
ALTER TABLE investment_sales ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

-- Backfill: updated_at baris existing = created_at-nya sendiri, sama
-- alasan dgn 0028 (baris lama belum pernah "di-update" sejak sync ada).
-- investment_accounts TIDAK perlu backfill -- updated_at-nya sudah lama
-- terisi (default (datetime('now')) sejak migrasi 0037).
UPDATE investment_purchases SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE investment_sales SET updated_at = created_at WHERE updated_at IS NULL;

-- Trigger auto-refresh updated_at saat UPDATE -- sama pola 0028, supaya
-- kode TS (mis. shared/investments/edit-purchase-form/, settle-sale-form/)
-- tidak perlu mengisi updated_at manual di tiap UPDATE statement.
CREATE TRIGGER trg_investment_accounts_updated_at
AFTER UPDATE ON investment_accounts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_accounts SET updated_at = datetime('now') WHERE account_id = NEW.account_id;
END;

CREATE TRIGGER trg_investment_purchases_updated_at
AFTER UPDATE ON investment_purchases
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_purchases SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_investment_sales_updated_at
AFTER UPDATE ON investment_sales
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_sales SET updated_at = datetime('now') WHERE id = NEW.id;
END;
