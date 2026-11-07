import type { SQLiteDatabase } from "expo-sqlite";

// Tabel valas + trigger updated_at/antrean sync + perluasan CHECK cloud_sync_queue (copy-and-rename, pola 0016/0017).
// Skema mengacu ke desktop (apps/desktop/docs/tables/forex.md) minus deleted_at/sync_source: mobile hard delete dan
// selalu bersumber 'pc'. Dokumen: docs/tables/forex.md. Rencana: docs/todos/plan/porting-account-forex.md.
const NOT_APPLYING_PULL = "(SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0";

function updatedAtTriggers(table: string, key: string) {
  return `
    CREATE TRIGGER trg_${table}_updated_at_ins
    AFTER INSERT ON ${table}
    FOR EACH ROW WHEN NEW.updated_at IS NULL
    BEGIN
      UPDATE ${table} SET updated_at = datetime('now') WHERE ${key} = NEW.${key};
    END;

    CREATE TRIGGER trg_${table}_updated_at_upd
    AFTER UPDATE ON ${table}
    FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
    BEGIN
      UPDATE ${table} SET updated_at = datetime('now') WHERE ${key} = NEW.${key};
    END;
  `;
}

function enqueue(table: string, rowRef: string, op: "upsert" | "delete", keepDelete = false) {
  const guard = keepDelete ? " WHERE cloud_sync_queue.op <> 'delete'" : "";
  return `
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      VALUES ('${table}', ${rowRef}, '${op}')
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = '${op}', attempts = 0, last_error = NULL${guard};`;
}

function queueTrigger(name: string, event: "INSERT" | "UPDATE" | "DELETE", table: string, body: string) {
  return `
    CREATE TRIGGER ${name}
    AFTER ${event} ON ${table}
    FOR EACH ROW WHEN ${NOT_APPLYING_PULL}
    BEGIN${body}
    END;
  `;
}

function ownQueueTriggers(table: string) {
  return [
    queueTrigger(`trg_${table}_queue_ins`, "INSERT", table, enqueue(table, "NEW.id", "upsert")),
    queueTrigger(`trg_${table}_queue_upd`, "UPDATE", table, enqueue(table, "NEW.id", "upsert")),
    queueTrigger(`trg_${table}_queue_del`, "DELETE", table, enqueue(table, "OLD.id", "delete")),
  ].join("");
}

// forex_accounts mengantre dirinya sendiri berkunci account_id dan tidak punya endpoint delete (pola investment_accounts).
function forexAccountQueueTriggers() {
  return [
    queueTrigger("trg_forex_accounts_queue_ins", "INSERT", "forex_accounts", enqueue("forex_accounts", "NEW.account_id", "upsert", true)),
    queueTrigger("trg_forex_accounts_queue_upd", "UPDATE", "forex_accounts", enqueue("forex_accounts", "NEW.account_id", "upsert", true)),
    queueTrigger("trg_forex_accounts_queue_del", "DELETE", "forex_accounts", enqueue("forex_accounts", "OLD.account_id", "upsert", true)),
  ].join("");
}

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE forex_accounts (
        account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        country TEXT NOT NULL,
        currency TEXT NOT NULL,
        current_rate REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE forex_purchases (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
        unit REAL NOT NULL,
        rate REAL NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );
      CREATE INDEX idx_forex_purchases_account ON forex_purchases(account_id);
      CREATE INDEX idx_forex_purchases_transaction ON forex_purchases(transaction_id);

      CREATE TABLE forex_sales (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
        adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
        unit REAL NOT NULL,
        rate REAL NOT NULL,
        average_cost_per_unit REAL NOT NULL,
        realized_pl REAL NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT
      );
      CREATE INDEX idx_forex_sales_account ON forex_sales(account_id);
      CREATE INDEX idx_forex_sales_transaction ON forex_sales(transaction_id);
      CREATE INDEX idx_forex_sales_adjustment_transaction ON forex_sales(adjustment_transaction_id);
    `);

    await db.execAsync(updatedAtTriggers("forex_accounts", "account_id"));
    await db.execAsync(updatedAtTriggers("forex_purchases", "id"));
    await db.execAsync(updatedAtTriggers("forex_sales", "id"));

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
            'transaction_labels', 'category_labels', 'account_labels',
            'forex_accounts', 'forex_purchases', 'forex_sales'
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

    await db.execAsync(forexAccountQueueTriggers());
    await db.execAsync(ownQueueTriggers("forex_purchases"));
    await db.execAsync(ownQueueTriggers("forex_sales"));
  });
}
