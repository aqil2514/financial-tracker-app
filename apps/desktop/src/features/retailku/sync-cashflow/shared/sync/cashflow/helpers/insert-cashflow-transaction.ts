import type { Db } from "../types";

export async function insertCashflowTransaction(
  db: Db,
  params: {
    accountId: number;
    amount: number;
    date: string;
    note: string;
    categoryId: number | null;
    description: string | null;
    sourceRef: string;
  }
): Promise<void> {
  const type = params.amount >= 0 ? "income" : "expense";
  await db.execute(
    `INSERT INTO transactions (type, amount, account_id, note, category_id, description, date, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'retailku_sync', $8)`,
    // `params.date` cuma "YYYY-MM-DD" (dipakai APA ADANYA untuk
    // sourceRef/tampilan preview) — kolom `transactions.date` HARUS
    // "YYYY-MM-DDTHH:mm" (lihat form-field-date.tsx: <input
    // type="datetime-local">, use-create-transaction.ts men-simpan
    // dengan format sama). Tanpa "T00:00" ini, form Edit Transaksi
    // membaca value tidak valid untuk datetime-local dan field Tanggal
    // tampil KOSONG (bug ditemukan live).
    [
      type,
      Math.abs(params.amount),
      params.accountId,
      params.note,
      params.categoryId,
      params.description,
      `${params.date}T00:00`,
      params.sourceRef,
    ]
  );
}
