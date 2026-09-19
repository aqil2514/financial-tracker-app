import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

// `next dev` (dipakai `tauri dev` lewat beforeDevCommand) selalu
// NODE_ENV=development, `next build` (dipakai `tauri build`) selalu
// NODE_ENV=production — jadi ini cara paling andal membedakan dev vs
// production DI RUNTIME JS (TAURI_ENV_DEBUG hanya tersedia saat proses
// build, bukan di WebView). Tanpa pemisahan ini, `tauri dev` dan hasil
// build/installer production berbagi file database yang sama persis.
const DB_FILE = process.env.NODE_ENV === "development" ? "finance.dev.db" : "finance.db";

export function getDb() {
  if (!dbPromise) {
    // SQLite mematikan foreign key enforcement secara default per koneksi —
    // wajib diaktifkan ulang di sini setiap kali database dibuka, bukan
    // cukup lewat migrasi (PRAGMA di migrasi hanya berlaku untuk koneksi
    // yang menjalankan migrasi itu, bukan koneksi-koneksi berikutnya).
    dbPromise = Database.load(`sqlite:${DB_FILE}`).then(async (db) => {
      await db.execute("PRAGMA foreign_keys = ON");
      return db;
    });
  }
  return dbPromise;
}

export type Category = {
  id: number;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parent_id: number | null;
  is_active: number;
};

export type AccountGroup = {
  id: number;
  name: string;
  created_at: string;
};

export type Account = {
  id: number;
  name: string;
  icon: string | null;
  initial_balance: number;
  group_id: number | null;
  description: string | null;
  created_at: string;
  is_active: number;
};

export type Transaction = {
  id: number;
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: number | null;
  account_id: number | null;
  transfer_account_id: number | null;
  note: string | null;
  /** JSON dokumen Tiptap terserialisasi (`JSON.stringify`), atau `null`
   * kalau belum diisi — deskripsi detail, terpisah dari `note`. */
  description: string | null;
  date: string;
  created_at: string;
};

export type Contact = {
  id: number;
  name: string;
  /** JSON dokumen Tiptap terserialisasi (`JSON.stringify`), atau `null`
   * kalau belum diisi. */
  note: string | null;
  created_at: string;
};
