import type { SQLiteDatabase } from "expo-sqlite";

// Hanya kamus label. Junction (account/category/transaction_labels) dan sync menyusul: docs/todos/plan/porting-labels.md.
export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE labels (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        UNIQUE (name, scope)
      );

      CREATE INDEX idx_labels_scope ON labels(scope);

      CREATE TRIGGER trg_labels_updated_at_ins
      AFTER INSERT ON labels
      FOR EACH ROW WHEN NEW.updated_at IS NULL
      BEGIN
        UPDATE labels SET updated_at = datetime('now') WHERE id = NEW.id;
      END;

      CREATE TRIGGER trg_labels_updated_at_upd
      AFTER UPDATE ON labels
      FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
      BEGIN
        UPDATE labels SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  });
}
