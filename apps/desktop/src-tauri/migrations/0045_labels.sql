-- Label generik lintas tabel -- desain lengkap & keputusan di
-- docs/todos/plan/general-label.md. Tabel BARU murni, tidak mengubah
-- skema tabel manapun yang sudah ada.
--
-- `labels` -- dictionary master, dipakai bersama lintas tabel.
-- `scope` dibatasi 2 nilai: 'transaction_category' (dipakai BERSAMA oleh
-- transaction_labels DAN category_labels -- keduanya saling fallback,
-- lihat "Resolusi nilai efektif" di dokumen) dan 'account' (jenis
-- instrumen investasi dst). BUKAN scope per junction table.
--
-- 3 junction table (transaction_labels/category_labels/account_labels)
-- SENGAJA punya `id` UUIDv7 sendiri (bukan composite PK polos) --
-- proyek ini belum pernah punya M2M sebelum ini, dan `id` dibutuhkan
-- sbg row_id di cloud_sync_queue (selalu 1 kolom TEXT) + primary key
-- tabel D1 versi Worker. `UNIQUE(x_id, label_id)` cuma cegah duplikat
-- attach label YANG SAMA 2x -- BUKAN pembatas "1 label per scope"
-- (sudah diputuskan BOLEH >1 label per scope per baris).
--
-- FK ketat ke tabel asli (ON DELETE CASCADE) dipertahankan di semua 3
-- junction table -- opsi gabung jadi 1 tabel polymorphic (entity_type +
-- entity_id generik tanpa FK) dipertimbangkan ulang & DITOLAK, lihat
-- diskusi di dokumen (risiko orphan row spt kasus attachment di
-- docs/dogfooding/2026-10-09-upload-attachment-corrupt-dan-orphan.md).
--
-- Semua 4 tabel ikut pola sync penuh (updated_at/deleted_at/sync_source
-- + trigger auto-refresh updated_at) krn label disync ke
-- apps/worker/apps/mcp-server SEJAK AWAL (bukan desktop-only dulu) --
-- pola identik 0028_cloud_sync_columns.sql, hanya di sini langsung jadi
-- bagian definisi CREATE TABLE (tabel baru, bukan ALTER tabel lama).

CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (name, scope)
);

CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);

CREATE TABLE category_labels (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (category_id, label_id)
);

CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);

CREATE INDEX idx_labels_scope ON labels(scope);
CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);
CREATE INDEX idx_category_labels_category ON category_labels(category_id);
CREATE INDEX idx_category_labels_label ON category_labels(label_id);
CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);

-- Trigger auto-refresh updated_at -- pola persis 0028_cloud_sync_columns.sql,
-- WHEN NEW.updated_at = OLD.updated_at mencegah infinite loop & mencegah
-- override kalau kode TS sengaja isi updated_at sendiri (hasil resolusi
-- pull dari D1 saat sync).
CREATE TRIGGER trg_labels_updated_at
AFTER UPDATE ON labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_transaction_labels_updated_at
AFTER UPDATE ON transaction_labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE transaction_labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_category_labels_updated_at
AFTER UPDATE ON category_labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE category_labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_account_labels_updated_at
AFTER UPDATE ON account_labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE account_labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;
