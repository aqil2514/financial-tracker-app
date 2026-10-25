import type { SQLiteDatabase } from "expo-sqlite";

// BELUM didaftarkan di migrations/index.ts — sengaja ditahan dulu
// sampai siap dijalankan. Lihat diskusi PRAGMA di migrate.ts.
//
// foreign_keys: default SQLite adalah OFF (demi backward compat lama),
// jadi FK (account_id, category_id, dst di transactions) TIDAK
// ditegakkan kecuali diaktifkan eksplisit di tiap koneksi. Baru benar-
// benar berguna begitu ada tabel accounts/categories dengan FK nyata
// ke transactions — sampai saat itu, aman ditunda.
//
// busy_timeout: tunggu N ms saat database ter-lock (mis. write
// bersamaan) alih-alih langsung lempar error "database is locked".
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
}
