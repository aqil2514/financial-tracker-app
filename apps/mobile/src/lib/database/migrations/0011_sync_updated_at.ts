import type { SQLiteDatabase } from "expo-sqlite";

// Tabel yang di-sync dan butuh updated_at untuk LWW. investment_accounts sudah
// punya kolomnya sejak 0009, jadi hanya mendapat trigger. Lihat docs/tables/cloud-sync.md.
const TABLES_ADDING_UPDATED_AT = [
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

const TABLE_KEYS: Record<string, string> = {
  ...Object.fromEntries(TABLES_ADDING_UPDATED_AT.map((table) => [table, "id"])),
  investment_accounts: "account_id",
};

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

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const table of TABLES_ADDING_UPDATED_AT) {
      await db.execAsync(`
        ALTER TABLE ${table} ADD COLUMN updated_at TEXT;
        UPDATE ${table} SET updated_at = created_at;
      `);
    }

    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL;
      CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
    `);

    for (const [table, key] of Object.entries(TABLE_KEYS)) {
      await db.execAsync(updatedAtTriggers(table, key));
    }
  });
}
