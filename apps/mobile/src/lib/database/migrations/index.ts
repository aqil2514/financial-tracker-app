import type { SQLiteDatabase } from "expo-sqlite";
import * as m0001 from "./0001_initial";
import * as m0002 from "./0002_pragma_defaults_and_attachments";
import * as m0003 from "./0003_categories";
import * as m0004 from "./0004_transaction_category_fk";
import * as m0005 from "./0005_accounts";
import * as m0006 from "./0006_transaction_cash_neutral";
import * as m0007 from "./0007_fix_orphaned_account_group_id";

export interface Migration {
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Urutan array = urutan eksekusi. Migrasi yang sudah pernah dirilis
// TIDAK BOLEH diedit (lihat feedback_migration_never_edit_applied di
// memory — prinsip yang sama berlaku di sini) — tambah file baru,
// daftarkan di bawah, jangan sentuh entri lama.
export const MIGRATIONS: Migration[] = [m0001, m0002, m0003, m0004, m0005, m0006, m0007];
