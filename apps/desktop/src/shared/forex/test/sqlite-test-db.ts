import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS_DIR = join(process.cwd(), "src-tauri", "migrations");

// SQLite asli + semua migrasi sungguhan (bukan fake DB), dibungkus agar cocok dengan
// antarmuka db.select/db.execute dan placeholder $1 yang dipakai kode aplikasi.
export function createTestDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();
  for (const file of files) {
    sqlite.exec(`BEGIN;\n${readFileSync(join(MIGRATIONS_DIR, file), "utf8")}\nCOMMIT;`);
  }

  function bind(params: unknown[] = []) {
    const named: Record<string, string | number | null> = {};
    params.forEach((value, index) => {
      named[`$${index + 1}`] = (value ?? null) as string | number | null;
    });
    return named;
  }

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      return sqlite.prepare(sql).all(bind(params)) as unknown as T;
    },
    async execute(sql: string, params: unknown[] = []) {
      sqlite.prepare(sql).run(bind(params));
      return { rowsAffected: 0 };
    },
  };

  return { db: db as never, sqlite };
}

// Saldo akun = initial_balance + income − expense − transfer keluar + transfer masuk.
export function balanceOf(sqlite: DatabaseSync, accountId: string): number {
  const row = sqlite
    .prepare(
      `SELECT a.initial_balance
         + COALESCE((SELECT SUM(amount) FROM transactions WHERE type='income' AND account_id=?1), 0)
         - COALESCE((SELECT SUM(amount) FROM transactions WHERE type='expense' AND account_id=?1), 0)
         - COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND account_id=?1), 0)
         + COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND transfer_account_id=?1), 0)
         AS balance
       FROM accounts a WHERE a.id = ?1`
    )
    .get(accountId) as { balance: number };
  return row.balance;
}
