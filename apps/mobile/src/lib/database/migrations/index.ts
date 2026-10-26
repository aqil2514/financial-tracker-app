import type { SQLiteDatabase } from "expo-sqlite";
import * as m0001 from "./0001_initial";
import * as m0002 from "./0002_pragma_defaults_and_attachments";
import * as m0003 from "./0003_categories";

export interface Migration {
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Urutan array = urutan eksekusi. Migrasi yang sudah pernah dirilis
// TIDAK BOLEH diedit (lihat feedback_migration_never_edit_applied di
// memory — prinsip yang sama berlaku di sini) — tambah file baru,
// daftarkan di bawah, jangan sentuh entri lama.
export const MIGRATIONS: Migration[] = [m0001, m0002, m0003];
