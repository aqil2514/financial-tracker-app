import type { SQLiteDatabase } from "expo-sqlite";
import * as m0001 from "./0001_initial";
import * as m0002 from "./0002_pragma_defaults_and_attachments";
import * as m0003 from "./0003_categories";
import * as m0004 from "./0004_transaction_category_fk";
import * as m0005 from "./0005_accounts";
import * as m0006 from "./0006_transaction_cash_neutral";
import * as m0007 from "./0007_fix_orphaned_account_group_id";
import * as m0008 from "./0008_debts";
import * as m0009 from "./0009_investments";
import * as m0010 from "./0010_third_party_funds";
import * as m0011 from "./0011_sync_updated_at";
import * as m0012 from "./0012_cloud_sync";
import * as m0013 from "./0013_local_datetime_format";
import * as m0014 from "./0014_attachment_sync_triggers";
import * as m0015 from "./0015_labels";
import * as m0016 from "./0016_labels_sync";

export interface Migration {
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Urutan array = urutan eksekusi. Migrasi yang sudah pernah dirilis
// TIDAK BOLEH diedit (lihat feedback_migration_never_edit_applied di
// memory — prinsip yang sama berlaku di sini) — tambah file baru,
// daftarkan di bawah, jangan sentuh entri lama.
export const MIGRATIONS: Migration[] = [
  m0001,
  m0002,
  m0003,
  m0004,
  m0005,
  m0006,
  m0007,
  m0008,
  m0009,
  m0010,
  m0011,
  m0012,
  m0013,
  m0014,
  m0015,
  m0016,
];
