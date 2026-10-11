-- Periode Kategori -- sisi Worker/D1 dari
-- docs/todos/plan/category-period-sync.md (lihat juga sisi desktop,
-- apps/desktop/src-tauri/migrations/0047_category_periods.sql/
-- 0048_category_periods_many_categories.sql).
--
-- Skema SUDAH many-to-many sejak migrasi PERTAMA di sini (beda dari
-- desktop yang mulai 1-kategori di 0047 lalu direvisi di 0048) --
-- category_periods TANPA category_id, tabel pivot
-- category_period_categories mencakup sekumpulan kategori sekaligus
-- (lintas tipe income/expense, mis. "Panen" = biaya pupuk + hasil
-- jual panen dalam satu periode yang sama).
--
-- Pola pivot PERSIS 3 junction table label (0005_labels.sql):
-- `id` UUIDv7 dari CALLER (bukan server-generate), SAMA PERSIS nilai
-- `id` baris ybs di SQLite lokal desktop -- kunci penghubung
-- lintas device. UNIQUE(period_id, category_id) cegah kategori yang
-- sama ditambahkan dobel ke periode yang sama.
--
-- CASCADE DELETE cuma hapus ROW D1 saat baris induk di-hard-delete --
-- soft-delete (UPDATE deleted_at) TIDAK trigger FK CASCADE sama
-- sekali (sama persis catatan 0003/0005). Replace-all pivot saat
-- update periode ditangani eksplisit oleh service.ts, bukan
-- mengandalkan CASCADE.

CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (period_id, category_id)
);
CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);
