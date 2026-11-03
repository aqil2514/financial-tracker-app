import type { SQLiteDatabase } from "expo-sqlite";

// Skema infrastruktur sync dan trigger antrean: lihat docs/tables/cloud-sync.md.
const NOT_APPLYING_PULL = "(SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0";

// Tabel yang antreannya memakai tabel itu sendiri, dengan kunci `id`.
const OWN_QUEUE_TABLES = [
  "account_groups",
  "categories",
  "contacts",
  "accounts",
  "transactions",
  "debts",
  "debt_payments",
  "investment_purchases",
  "investment_sales",
  "third_party_funds",
  "category_periods",
];

function enqueue(table: string, rowRef: string, op: "upsert" | "delete", keepDelete = false) {
  const guard = keepDelete ? " WHERE cloud_sync_queue.op <> 'delete'" : "";
  return `
      INSERT INTO cloud_sync_queue (table_name, row_id, op)
      VALUES ('${table}', ${rowRef}, '${op}')
      ON CONFLICT (table_name, row_id)
      DO UPDATE SET op = '${op}', attempts = 0, last_error = NULL${guard};`;
}

function trigger(name: string, event: "INSERT" | "UPDATE" | "DELETE", table: string, body: string) {
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
    trigger(`trg_${table}_queue_ins`, "INSERT", table, enqueue(table, "NEW.id", "upsert")),
    trigger(`trg_${table}_queue_upd`, "UPDATE", table, enqueue(table, "NEW.id", "upsert")),
    trigger(`trg_${table}_queue_del`, "DELETE", table, enqueue(table, "OLD.id", "delete")),
  ].join("");
}

// Baris turunan yang ikut dikirim di payload induknya hanya me-enqueue induk.
// keepDelete: cascade hapus induk tidak boleh membalik entry delete induk jadi upsert.
function childQueueTriggers(name: string, table: string, parent: string, column: string) {
  return [
    trigger(`trg_${name}_queue_ins`, "INSERT", table, enqueue(parent, `NEW.${column}`, "upsert", true)),
    trigger(`trg_${name}_queue_upd`, "UPDATE", table, enqueue(parent, `NEW.${column}`, "upsert", true)),
    trigger(`trg_${name}_queue_del`, "DELETE", table, enqueue(parent, `OLD.${column}`, "upsert", true)),
  ].join("");
}

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      CREATE TABLE cloud_sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        worker_url TEXT,
        checkpoint TEXT,
        attachment_checkpoint TEXT,
        applying_pull INTEGER NOT NULL DEFAULT 0 CHECK (applying_pull IN (0, 1))
      );

      INSERT INTO cloud_sync_state (id) VALUES (1);

      CREATE TABLE cloud_sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL CHECK (
          table_name IN (
            'account_groups', 'categories', 'contacts', 'accounts',
            'transactions', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'category_periods', 'third_party_funds',
            'transaction_attachments'
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

      CREATE TABLE cloud_sync_rejected_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('push', 'pull')),
        reason TEXT NOT NULL,
        rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (table_name, row_id, direction)
      );
    `);

    for (const table of OWN_QUEUE_TABLES) {
      await db.execAsync(ownQueueTriggers(table));
    }

    await db.execAsync(childQueueTriggers("debt_accounts", "debt_accounts", "accounts", "account_id"));
    await db.execAsync(childQueueTriggers("investment_accounts", "investment_accounts", "investment_accounts", "account_id"));
    await db.execAsync(childQueueTriggers("category_period_categories", "category_period_categories", "category_periods", "period_id"));
  });
}
