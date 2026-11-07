import type { SQLiteDatabase } from "expo-sqlite";

// Membuka 'forex' di CHECK accounts.account_type. SQLite tidak bisa ALTER CHECK, jadi accounts dibangun ulang
// dengan prosedur resmi SQLite (foreign_keys OFF -> tabel baru -> salin -> drop -> rename), BUKAN rename-semua-anak
// seperti desktop: anak-anaknya (debts, investment_*, third_party_funds, dst) menunjuk ke nama "accounts" dan
// tetap valid setelah tabel baru memakai nama itu. Isi tabel anak tidak disentuh. Rencana: docs/todos/plan/porting-account-forex.md.
export async function up(db: SQLiteDatabase) {
  // PRAGMA foreign_keys tidak berlaku di dalam transaksi, jadi diset di luar dan DIKEMBALIKAN apa pun hasilnya.
  await db.execAsync("PRAGMA foreign_keys = OFF");
  try {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE accounts_new (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          icon TEXT,
          color TEXT,
          initial_balance REAL NOT NULL DEFAULT 0,
          account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party', 'forex')),
          group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
          description TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT
        );

        INSERT INTO accounts_new (
          id, name, icon, color, initial_balance, account_type, group_id, description, is_active, created_at, updated_at
        )
        SELECT id, name, icon, color, initial_balance, account_type, group_id, description, is_active, created_at, updated_at
        FROM accounts;

        DROP TABLE accounts;
        PRAGMA legacy_alter_table = ON;
        ALTER TABLE accounts_new RENAME TO accounts;
        PRAGMA legacy_alter_table = OFF;

        CREATE INDEX idx_accounts_group ON accounts(group_id);

        CREATE TRIGGER trg_accounts_updated_at_ins
        AFTER INSERT ON accounts
        FOR EACH ROW WHEN NEW.updated_at IS NULL
        BEGIN
          UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
        END;

        CREATE TRIGGER trg_accounts_updated_at_upd
        AFTER UPDATE ON accounts
        FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
        BEGIN
          UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
        END;

        CREATE TRIGGER trg_accounts_queue_ins
        AFTER INSERT ON accounts
        FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
        BEGIN
          INSERT INTO cloud_sync_queue (table_name, row_id, op)
          VALUES ('accounts', NEW.id, 'upsert')
          ON CONFLICT (table_name, row_id)
          DO UPDATE SET op = 'upsert', attempts = 0, last_error = NULL;
        END;

        CREATE TRIGGER trg_accounts_queue_upd
        AFTER UPDATE ON accounts
        FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
        BEGIN
          INSERT INTO cloud_sync_queue (table_name, row_id, op)
          VALUES ('accounts', NEW.id, 'upsert')
          ON CONFLICT (table_name, row_id)
          DO UPDATE SET op = 'upsert', attempts = 0, last_error = NULL;
        END;

        CREATE TRIGGER trg_accounts_queue_del
        AFTER DELETE ON accounts
        FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
        BEGIN
          INSERT INTO cloud_sync_queue (table_name, row_id, op)
          VALUES ('accounts', OLD.id, 'delete')
          ON CONFLICT (table_name, row_id)
          DO UPDATE SET op = 'delete', attempts = 0, last_error = NULL;
        END;
      `);

      const violations = await db.getAllAsync<{ table: string }>("PRAGMA foreign_key_check");
      if (violations.length > 0) {
        throw new Error(`Migrasi 0018 membuat pelanggaran foreign key di: ${violations.map((v) => v.table).join(", ")}`);
      }
    });
  } finally {
    await db.execAsync("PRAGMA foreign_keys = ON");
  }
}
