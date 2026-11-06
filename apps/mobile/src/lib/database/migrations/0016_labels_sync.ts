import type { SQLiteDatabase } from "expo-sqlite";

// Sync untuk labels: daftar CHECK cloud_sync_queue diperluas lewat copy-and-rename (SQLite tidak bisa
// mengubah CHECK), lalu trigger antrean dipasang. legacy_alter_table dinyalakan selama rename karena trigger tabel
// lain merujuk cloud_sync_queue yang sesaat tidak ada, dan rename normal menolaknya. Pola trigger sama dengan 0012. Lihat docs/tables/cloud-sync.md.
const NOT_APPLYING_PULL = "(SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0";

function queueTrigger(name: string, event: "INSERT" | "UPDATE" | "DELETE", op: "upsert" | "delete") {
  const rowRef = event === "DELETE" ? "OLD.id" : "NEW.id";
  return `
    CREATE TRIGGER ${name}
    AFTER ${event} ON labels
    FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
    BEGIN
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      VALUES ('labels', ${rowRef}, '${op}')
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = '${op}', attempts = 0, last_error = NULL;
    END;
  `;
}

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE cloud_sync_queue_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL CHECK (
          table_name IN (
            'account_groups', 'categories', 'contacts', 'accounts',
            'transactions', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'category_periods', 'third_party_funds',
            'transaction_attachments', 'labels'
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

    await db.execAsync(
      [
        queueTrigger("trg_labels_queue_ins", "INSERT", "upsert"),
        queueTrigger("trg_labels_queue_upd", "UPDATE", "upsert"),
        queueTrigger("trg_labels_queue_del", "DELETE", "delete"),
      ].join("")
    );

    // Label yang dibuat sebelum sync label ada belum pernah masuk antrean.
    await db.execAsync(`
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      SELECT 'labels', id, 'upsert' FROM labels WHERE true
      ON CONFLICT (table_name, row_id) DO NOTHING;
    `);
  });
}
