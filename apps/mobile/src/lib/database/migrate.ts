import type { SQLiteDatabase } from "expo-sqlite";
import { MIGRATIONS } from "./migrations";

export const DATABASE_NAME = "finance.db";

// Jalankan migrasi yang belum ter-apply, berurutan sesuai MIGRATIONS.
// Tidak perlu diedit saat menambah migrasi baru — cukup tambah file
// baru di migrations/ dan daftarkan di migrations/index.ts.
export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  let currentVersion = result?.user_version ?? 0;

  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    await MIGRATIONS[i].up(db);
    currentVersion = i + 1;
    await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
  }
}
