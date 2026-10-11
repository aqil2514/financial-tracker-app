-- Periode Kategori -- jendela waktu custom bernama, scope SATU
-- kategori, utk menjawab "panen tahun kemarin keluar-masuknya
-- berapa?". Desain lengkap & keputusan di
-- docs/todos/plan/category-period-sync.md (index) dan
-- apps/desktop/docs/todos/plan/category-period.md (detail desktop).
--
-- Tabel BARU murni, tidak mengubah skema tabel manapun yang sudah
-- ada. TIDAK ada tabel ledger/history terpisah -- ringkasan (total
-- masuk/keluar/selisih + daftar transaksi) SELALU dihitung on-the-fly
-- dari `transactions WHERE category_id = ? AND date BETWEEN
-- start_date AND end_date`, sama prinsip dengan `accounts.balance`
-- yang derived, bukan disimpan ulang di sini.
--
-- Ikut pola sync penuh (updated_at/deleted_at/sync_source + trigger
-- auto-refresh updated_at) SEJAK AWAL -- pola PERSIS 0045_labels.sql
-- -- krn sync ke apps/worker/apps/mcp-server sudah diputuskan perlu
-- dari awal (BEDA dari investasi yang baru nambah kolom ini belakangan
-- di migrasi 0042 setelah desktop-only lebih dulu).

CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_category_periods_category ON category_periods(category_id);

CREATE TRIGGER trg_category_periods_updated_at
AFTER UPDATE ON category_periods
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE category_periods SET updated_at = datetime('now') WHERE id = NEW.id;
END;
