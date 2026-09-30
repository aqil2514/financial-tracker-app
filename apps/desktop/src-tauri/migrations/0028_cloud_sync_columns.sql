-- Tahap 3 dari docs/todos/plan/mcp-server-cloud-mirror.md: kolom
-- pendukung sync dua-arah PC <-> Cloudflare D1 (lihat dokumen itu utk
-- keputusan desain lengkap: LWW via updated_at, soft delete, dst).
--
-- Cakupan: 7 tabel data user yg relevan disinkron (bukan `settings` yg
-- murni config lokal per-device, bukan `transaction_attachments` yg
-- filenya di luar D1 sama sekali).
--
-- `updated_at`: basis last-write-wins. Diisi sama dgn `created_at` saat
-- INSERT (belum pernah di-update), lalu di-refresh otomatis via trigger
-- AFTER UPDATE -- TIDAK mengandalkan kode TS mengisi manual di tiap
-- titik (rawan lupa/inkonsisten format, lihat catatan format tanggal
-- custom di mcp-server-business-logic-audit.md).
--
-- `deleted_at`: soft delete, nullable. SEMUA SELECT existing di kode
-- app TIDAK berubah (masih hard-delete via DELETE FROM seperti biasa) --
-- kolom ini BARU dipakai nanti saat integrasi sync sungguhan (Tahap 6),
-- belum ada perubahan perilaku sekarang.
--
-- `sync_source`: `'pc'` (default, semua data existing berasal dari PC)
-- atau `'mcp'`. DINAMAI `sync_source`, BUKAN `source` -- `transactions`
-- dan `debts` SUDAH punya kolom `source` dgn makna beda sama sekali
-- (asal data bisnis: 'manual'/'retailku_sync', lihat
-- 0017_transaction_source.sql & 0025_debts_source_ref.sql). Memakai
-- nama sama akan bentrok & membingungkan dua konsep berbeda (asal
-- data bisnis vs asal penulis untuk keperluan sync cloud).

-- CATATAN TEKNIS: SQLite menolak "ALTER TABLE ADD COLUMN ... DEFAULT
-- (datetime('now'))" (non-constant default) pada tabel yang SUDAH
-- berisi baris data ("Cannot add a column with non-constant default").
-- Makanya `updated_at` ditambah dulu TANPA default/NOT NULL, lalu
-- di-backfill via UPDATE terpisah. Kolom TIDAK dipaksa NOT NULL di
-- level skema (SQLite tidak mendukung itu tanpa rebuild tabel penuh
-- spt pola 0009_enforce_fk_set_null.sql) -- konsistensi "selalu terisi"
-- dijaga di kode TS (trigger + backfill di bawah memastikan tidak ada
-- baris NULL setelah migrasi ini).

ALTER TABLE transactions ADD COLUMN updated_at TEXT;
ALTER TABLE transactions ADD COLUMN deleted_at TEXT;
ALTER TABLE transactions ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE accounts ADD COLUMN updated_at TEXT;
ALTER TABLE accounts ADD COLUMN deleted_at TEXT;
ALTER TABLE accounts ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE account_groups ADD COLUMN updated_at TEXT;
ALTER TABLE account_groups ADD COLUMN deleted_at TEXT;
ALTER TABLE account_groups ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE categories ADD COLUMN updated_at TEXT;
ALTER TABLE categories ADD COLUMN deleted_at TEXT;
ALTER TABLE categories ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE contacts ADD COLUMN updated_at TEXT;
ALTER TABLE contacts ADD COLUMN deleted_at TEXT;
ALTER TABLE contacts ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE debts ADD COLUMN updated_at TEXT;
ALTER TABLE debts ADD COLUMN deleted_at TEXT;
ALTER TABLE debts ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

ALTER TABLE debt_payments ADD COLUMN updated_at TEXT;
ALTER TABLE debt_payments ADD COLUMN deleted_at TEXT;
ALTER TABLE debt_payments ADD COLUMN sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'));

-- Backfill: updated_at baris existing = created_at-nya sendiri (baris
-- lama belum pernah "di-update" sejak sync ada, jadi timestamp paling
-- masuk akal adalah saat baris itu dibuat).
UPDATE transactions SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE accounts SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE account_groups SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE categories SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE contacts SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE debts SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE debt_payments SET updated_at = created_at WHERE updated_at IS NULL;

-- Trigger auto-refresh updated_at saat UPDATE -- supaya kode TS tidak
-- perlu (dan tidak boleh lupa) mengisi updated_at manual di tiap
-- UPDATE statement. `WHEN NEW.updated_at = OLD.updated_at` mencegah
-- infinite loop trigger (UPDATE di dalam trigger UPDATE) dan mencegah
-- override kalau kode TS suatu saat memang sengaja mengisi updated_at
-- sendiri (mis. hasil resolusi pull dari D1 saat sync).
CREATE TRIGGER trg_transactions_updated_at
AFTER UPDATE ON transactions
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_accounts_updated_at
AFTER UPDATE ON accounts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_account_groups_updated_at
AFTER UPDATE ON account_groups
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE account_groups SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_categories_updated_at
AFTER UPDATE ON categories
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_contacts_updated_at
AFTER UPDATE ON contacts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE contacts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_debts_updated_at
AFTER UPDATE ON debts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE debts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_debt_payments_updated_at
AFTER UPDATE ON debt_payments
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE debt_payments SET updated_at = datetime('now') WHERE id = NEW.id;
END;
