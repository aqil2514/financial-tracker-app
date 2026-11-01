import type { SQLiteDatabase } from "expo-sqlite";
import { MIGRATIONS } from "../migrations";

// Subset node:sqlite yang dipakai di sini. App mobile tidak memasang @types/node, jadi modulnya dimuat
// dinamis lewat variabel (tidak di-resolve tsc) dan diketik lokal.
type SqlValue = string | number | null;
type RawDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: SqlValue[]): unknown;
    get(...params: SqlValue[]): unknown;
    all(...params: SqlValue[]): unknown[];
  };
};

const NODE_SQLITE = "node:sqlite";

// Khusus test: SQLite asli (node:sqlite, in-memory) berbentuk subset SQLiteDatabase yang dipakai kode
// shared/, dengan SELURUH migrasi mobile sudah dijalankan — jadi test memakai skema dan SQL sungguhan.
export async function createSqliteTestDb(): Promise<SQLiteDatabase> {
  const { DatabaseSync } = (await import(NODE_SQLITE)) as { DatabaseSync: new (path: string) => RawDb };
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");

  const adapter = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, params: SqlValue[] = []) => {
      raw.prepare(sql).run(...params);
    },
    getFirstAsync: async (sql: string, params: SqlValue[] = []) => raw.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: SqlValue[] = []) => raw.prepare(sql).all(...params),
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec("BEGIN");
      try {
        await task();
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };

  const db = adapter as unknown as SQLiteDatabase;
  for (const migration of MIGRATIONS) await migration.up(db);
  return db;
}
