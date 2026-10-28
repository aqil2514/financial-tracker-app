import type { SQLiteDatabase } from "expo-sqlite";

// Perbaikan data: sebelum migrasi ini, PRAGMA foreign_keys cuma di-set
// ON sekali saat 0002 pertama kali jalan (pragma ini per-koneksi,
// tidak persisten ke file DB) — jadi di koneksi setelah restart app
// pertama, ON DELETE SET NULL di accounts.group_id diam-diam tidak
// jalan, meninggalkan group_id yang menunjuk baris account_groups yang
// sudah dihapus. migrate.ts sekarang set pragma ini di setiap init,
// tapi baris yang sudah terlanjur orphan sebelum perbaikan itu perlu
// dibersihkan manual di sini.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    UPDATE accounts
    SET group_id = NULL
    WHERE group_id IS NOT NULL
      AND group_id NOT IN (SELECT id FROM account_groups);
  `);
}
