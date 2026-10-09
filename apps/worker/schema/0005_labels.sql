-- Label generik lintas tabel -- sisi Worker/D1 dari
-- docs/todos/plan/general-label.md (lihat juga sisi desktop,
-- apps/desktop/src-tauri/migrations/0045_labels.sql/0046_*.sql).
--
-- Skema IDENTIK sisi desktop secara struktur (kolom, FK, CHECK) --
-- hanya `updated_at`/`deleted_at` nullable TANPA DEFAULT/NOT NULL,
-- pola PERSIS semua tabel lain sejak 0001_initial.sql (Worker SELALU
-- isi eksplisit saat INSERT/UPDATE, tanpa trigger DB -- D1 tidak
-- punya trigger spt SQLite lokal).
--
-- `id` 3 junction table (transaction_labels/category_labels/
-- account_labels) WAJIB UUIDv7 dari caller (bukan server-generate),
-- SAMA PERSIS nilai `id` baris ybs di SQLite lokal desktop -- pola
-- sama `transaction_attachments` (lihat 0003_transaction_attachments.sql),
-- inilah kunci penghubung lintas device.
--
-- CASCADE DELETE di sini cuma hapus ROW D1 saat baris induk (transaksi/
-- kategori/akun) di-hard-delete -- soft-delete (UPDATE deleted_at) tidak
-- trigger FK CASCADE sama sekali (sama persis catatan di
-- 0003_transaction_attachments.sql), jadi "detach" label tetap wajib
-- ditangani eksplisit sbg UPDATE deleted_at oleh controller, bukan
-- mengandalkan CASCADE.

CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (name, scope)
);
CREATE INDEX idx_labels_scope ON labels(scope);

CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);
CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);

CREATE TABLE category_labels (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (category_id, label_id)
);
CREATE INDEX idx_category_labels_category ON category_labels(category_id);
CREATE INDEX idx_category_labels_label ON category_labels(label_id);

CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);
CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);
