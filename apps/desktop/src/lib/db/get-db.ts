import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

const DB_FILE = process.env.NODE_ENV === "development" ? "finance.dev.db" : "finance.db";

export function getDb() {
  if (!dbPromise) {
    dbPromise = Database.load(`sqlite:${DB_FILE}`).then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON");
      return db;
    });
  }
  return dbPromise;
}
