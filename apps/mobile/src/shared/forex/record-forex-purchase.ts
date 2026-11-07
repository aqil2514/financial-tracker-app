import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";

export type RecordForexPurchaseInput = {
  db: SQLiteDatabase;
  forexAccountId: string;
  // null = mode direct: valas yang sudah dipegang tanpa kas sumber yang dilacak (income ke akun valas).
  cashAccountId: string | null;
  unit: number;
  rate: number;
  date: string;
  note: string;
};

export type RecordForexPurchaseResult = { transactionId: string; purchaseId: string };

async function getAccountType(db: SQLiteDatabase, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>("SELECT account_type FROM accounts WHERE id = ?", [accountId]);
  return row?.account_type ?? null;
}

// Nominal transaksi = unit × rate, supaya modal (saldo akun) selalu cocok dengan riwayat beli. Satu transaksi SQLite:
// transaksi tanpa baris forex_purchases (atau sebaliknya) tidak boleh tersimpan setengah-setengah.
export async function recordForexPurchase(input: RecordForexPurchaseInput): Promise<RecordForexPurchaseResult> {
  const { db, forexAccountId, cashAccountId, unit, rate, date, note } = input;
  if (!(unit > 0)) throw new Error("Jumlah unit harus lebih dari 0.");
  if (!(rate > 0)) throw new Error("Kurs harus lebih dari 0.");

  if ((await getAccountType(db, forexAccountId)) !== "forex") throw new Error("Akun tujuan pembelian harus bertipe Valas.");
  if (cashAccountId != null && (await getAccountType(db, cashAccountId)) !== "cash") {
    throw new Error("Akun sumber pembelian harus bertipe Kas.");
  }

  const amount = unit * rate;
  const transactionId = generateId();
  const purchaseId = generateId();

  await db.withTransactionAsync(async () => {
    if (cashAccountId == null) {
      await db.runAsync(
        `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, NULL, 'income', ?, ?, NULL, ?, NULL)`,
        [transactionId, note, amount, date, forexAccountId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, NULL, 'transfer', ?, ?, NULL, ?, ?)`,
        [transactionId, note, amount, date, cashAccountId, forexAccountId]
      );
    }
    await db.runAsync(
      `INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date) VALUES (?, ?, ?, ?, ?, ?)`,
      [purchaseId, forexAccountId, transactionId, unit, rate, date]
    );
  });

  return { transactionId, purchaseId };
}
