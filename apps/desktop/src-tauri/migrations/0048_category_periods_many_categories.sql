-- Revisi 0047: satu Periode ternyata perlu mencakup LEBIH DARI SATU
-- kategori sekaligus -- kategori di app ini dipisah per TIPE transaksi
-- (income/expense terpisah, lihat categories.type), jadi siklus nyata
-- spt "panen" (biaya pupuk/bibit = expense, hasil jual = income) tidak
-- bisa direpresentasikan sbg satu category_id tunggal. Keputusan
-- (2026-10-11): many-to-many lewat tabel pivot, BUKAN tetap 1 kategori
-- + digabung manual di UI by name -- lihat
-- docs/todos/plan/category-period-sync.md utk diskusi lengkap.
--
-- category_periods di-rebuild TANPA category_id (pola copy-and-rename
-- sederhana, docs/rules/sqlite-copy-and-rename-migration.md -- aman
-- krn tidak ada tabel lain yg REFERENCES category_periods, dikonfirmasi
-- via grep sebelum menulis migrasi ini). Kolom lain (name/start_date/
-- end_date/kolom LWW) disalin apa adanya.
--
-- category_period_categories: tabel pivot baru, id UUIDv7 sendiri
-- (bukan composite PK polos) -- pola PERSIS 3 junction table label
-- (0045_labels.sql: transaction_labels/category_labels/account_labels)
-- krn alasan yg sama: proyek ini butuh row_id tunggal utk
-- cloud_sync_queue (selalu 1 kolom TEXT) + primary key tabel D1 versi
-- Worker. UNIQUE(period_id, category_id) cegah kategori yg sama
-- ditambahkan dobel ke periode yg sama, BUKAN pembatas jumlah kategori
-- per periode (boleh banyak kategori, lintas tipe income/expense
-- sekaligus -- itu justru tujuan revisi ini).
--
-- PENTING: baris category_periods LAMA (sebelum migrasi ini) akan
-- kehilangan category_id-nya tanpa pengganti otomatis di
-- category_period_categories -- backfill data lama DILEWATI SENGAJA
-- krn fitur ini baru dibuat (2026-10-11), belum ada data nyata user
-- yg perlu dipertahankan (lihat feedback_backfill_migration_verify_not_assume,
-- prinsipnya tetap "verifikasi dulu", hasil verifikasi di sini: tabel
-- category_periods masih kosong di semua device, migrasi 0047 belum
-- pernah dipakai bikin data sungguhan).

CREATE TABLE category_periods_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

INSERT INTO category_periods_new (id, name, start_date, end_date, created_at, updated_at, deleted_at, sync_source)
SELECT id, name, start_date, end_date, created_at, updated_at, deleted_at, sync_source
FROM category_periods;

DROP INDEX IF EXISTS idx_category_periods_category;
DROP TRIGGER IF EXISTS trg_category_periods_updated_at;
DROP TABLE category_periods;
ALTER TABLE category_periods_new RENAME TO category_periods;

CREATE TRIGGER trg_category_periods_updated_at
AFTER UPDATE ON category_periods
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE category_periods SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (period_id, category_id)
);

CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);

CREATE TRIGGER trg_category_period_categories_updated_at
AFTER UPDATE ON category_period_categories
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE category_period_categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;
