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
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  parent_id: string | null;
  is_active: number;
};

export type AccountGroup = {
  id: string;
  name: string;
  created_at: string;
};

export type Account = {
  id: string;
  name: string;
  /** Nama komponen lucide-react (mis. "Wallet"), lihat
   * lib/account-icons.ts — null kalau belum dipilih (fallback ke icon
   * default saat dirender). */
  icon: string | null;
  /** Nama warna dari palet TERBATAS, lihat lib/account-colors.ts — null
   * kalau belum dipilih (fallback ke warna default saat dirender).
   * Independen dari `icon`: bentuk dan warna dipilih terpisah. */
  color: string | null;
  initial_balance: number;
  group_id: string | null;
  description: string | null;
  created_at: string;
  is_active: number;
  account_type: "cash" | "debt";
};

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: string | null;
  account_id: string | null;
  transfer_account_id: string | null;
  note: string;
  /** JSON dokumen Tiptap terserialisasi (`JSON.stringify`), atau `null`
   * kalau belum diisi — deskripsi detail, terpisah dari `note`. */
  description: string | null;
  date: string;
  created_at: string;
  contact_id: string | null;
};

export type Contact = {
  id: string;
  name: string;
  /** JSON dokumen Tiptap terserialisasi (`JSON.stringify`), atau `null`
   * kalau belum diisi. */
  note: string | null;
  created_at: string;
};

export type Debt = {
  id: string;
  /** 'receivable' = piutang (orang lain berutang ke saya), 'payable' =
   * utang (saya berutang ke orang lain). */
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  /** Jejak transaksi transfer otomatis yang membuat piutang/utang ini. */
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  created_at: string;
};

export type DebtPayment = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  /** Jejak transaksi transfer otomatis untuk cicilan/pelunasan ini. */
  transaction_id: string | null;
  note: string | null;
  date: string;
  created_at: string;
};
