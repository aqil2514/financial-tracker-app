import type { Env } from "./env";

type ParentTable = "accounts" | "categories" | "contacts" | "transactions" | "debts";

export type ParentRef = {
  table: ParentTable;
  id: string | null | undefined;
  // Nama untuk pesan penolakan, mis. "Akun".
  label: string;
};

// Endpoint push (PC/HP) menulis baris anak yang FK-nya menunjuk ke induk yang mungkin belum ter-sync ke D1
// (race antar push, atau induk sudah dihapus). Tanpa pemeriksaan ini INSERT/UPDATE kena
// SQLITE_CONSTRAINT_FOREIGNKEY mentah dan lolos jadi 500. Dengan ini klien menerima 422 + alasan yang jelas.
//
// Sengaja TIDAK menyaring `deleted_at`: yang diperiksa persis kondisi yang membuat FK D1 gagal (baris tidak
// ada). Induk yang sudah di-soft-delete tetap dianggap ada, jadi alur yang sekarang berhasil tidak berubah.
export async function findMissingParent(env: Env, refs: ParentRef[]): Promise<string | null> {
  for (const ref of refs) {
    if (!ref.id) continue;
    const row = await env.DB.prepare(`SELECT 1 FROM ${ref.table} WHERE id = ?1`).bind(ref.id).first();
    if (row === null) {
      return `${ref.label} belum ditemukan di cloud (kemungkinan belum ter-sync) — coba lagi setelah ${ref.label.toLowerCase()} tersinkron.`;
    }
  }
  return null;
}
