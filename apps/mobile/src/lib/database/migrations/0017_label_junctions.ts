import type { SQLiteDatabase } from "expo-sqlite";

// Tabel junction label (transaksi/kategori/akun) + antrean sync-nya. Skema: docs/tables/label.md.
// Beda dari desktop: tanpa deleted_at/sync_source, detach = hard delete lokal, jadi trigger DELETE mengisi
// `payload` antrean dengan pasangan (entity, label) yang dibutuhkan DELETE /labels/:scope/:entityId/:labelId.
const NOT_APPLYING_PULL = "(SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0";

const JUNCTIONS = [
  { table: "transaction_labels", entityColumn: "transaction_id", entityTable: "transactions" },
  { table: "category_labels", entityColumn: "category_id", entityTable: "categories" },
  { table: "account_labels", entityColumn: "account_id", entityTable: "accounts" },
] as const;

function createJunction({ table, entityColumn, entityTable }: (typeof JUNCTIONS)[number]) {
  return `
    CREATE TABLE ${table} (
      id TEXT PRIMARY KEY NOT NULL,
      ${entityColumn} TEXT NOT NULL REFERENCES ${entityTable}(id) ON DELETE CASCADE,
      label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE (${entityColumn}, label_id)
    );

    CREATE INDEX idx_${table}_entity ON ${table}(${entityColumn});
    CREATE INDEX idx_${table}_label ON ${table}(label_id);

    CREATE TRIGGER trg_${table}_updated_at_ins
    AFTER INSERT ON ${table}
    FOR EACH ROW WHEN NEW.updated_at IS NULL
    BEGIN
      UPDATE ${table} SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER trg_${table}_updated_at_upd
    AFTER UPDATE ON ${table}
    FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
    BEGIN
      UPDATE ${table} SET updated_at = datetime('now') WHERE id = NEW.id;
    END;

    CREATE TRIGGER trg_${table}_queue_ins
    AFTER INSERT ON ${table}
    FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
    BEGIN
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      VALUES ('${table}', NEW.id, 'upsert')
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = 'upsert', payload = NULL, attempts = 0, last_error = NULL;
    END;

    CREATE TRIGGER trg_${table}_queue_upd
    AFTER UPDATE ON ${table}
    FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
    BEGIN
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      VALUES ('${table}', NEW.id, 'upsert')
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = 'upsert', payload = NULL, attempts = 0, last_error = NULL;
    END;

    CREATE TRIGGER trg_${table}_queue_del
    AFTER DELETE ON ${table}
    FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
    BEGIN
      INSERT INTO cloud_sync_queue (table_name, row_id, op, payload)
      VALUES ('${table}', OLD.id, 'delete', json_object('entityId', OLD.${entityColumn}, 'labelId', OLD.label_id))
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = 'delete', payload = excluded.payload, attempts = 0, last_error = NULL;
    END;
  `;
}

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const junction of JUNCTIONS) {
      await db.execAsync(createJunction(junction));
    }

    // Daftar CHECK diperluas lewat copy-and-rename, pola dan alasan legacy_alter_table sama dengan 0016.
    await db.execAsync(`
      CREATE TABLE cloud_sync_queue_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL CHECK (
          table_name IN (
            'account_groups', 'categories', 'contacts', 'accounts',
            'transactions', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'category_periods', 'third_party_funds',
            'transaction_attachments', 'labels',
            'transaction_labels', 'category_labels', 'account_labels'
          )
        ),
        row_id TEXT NOT NULL,
        op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        payload TEXT,
        UNIQUE (table_name, row_id)
      );

      INSERT INTO cloud_sync_queue_new (id, table_name, row_id, op, attempts, last_error, created_at, payload)
      SELECT id, table_name, row_id, op, attempts, last_error, created_at, payload FROM cloud_sync_queue;

      DROP TABLE cloud_sync_queue;
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE cloud_sync_queue_new RENAME TO cloud_sync_queue;
      PRAGMA legacy_alter_table = OFF;
    `);
  });
}
