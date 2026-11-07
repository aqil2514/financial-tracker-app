import type { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { newId } from "@/lib/id";

type Db = Awaited<ReturnType<typeof getDb>>;

export type CreateForexPurchaseInput = {
  db: Db;
  forexAccountId: string;
  // null = mode direct: valas yang sudah dipegang tanpa kas sumber yang dilacak (transaksi income ke akun valas).
  cashAccountId: string | null;
  unit: number;
  rate: number;
  date: string;
  note: string;
};

export type CreateForexPurchaseResult = { transactionId: string; purchaseId: string };

// Nominal transaksi = unit × rate, supaya modal (accounts.balance) selalu cocok dengan riwayat beli.
// Biaya admin bank, kalau ada, dicatat sebagai transaksi pengeluaran terpisah.
export async function createForexPurchase({
  db,
  forexAccountId,
  cashAccountId,
  unit,
  rate,
  date,
  note,
}: CreateForexPurchaseInput): Promise<CreateForexPurchaseResult> {
  if (!(unit > 0)) throw new Error("Jumlah unit harus lebih dari 0.");
  if (!(rate > 0)) throw new Error("Kurs harus lebih dari 0.");

  if ((await getAccountType(db, forexAccountId)) !== "forex") {
    throw new Error("Akun tujuan pembelian harus bertipe Valas.");
  }
  if (cashAccountId != null && (await getAccountType(db, cashAccountId)) !== "cash") {
    throw new Error("Akun sumber pembelian harus bertipe Kas.");
  }

  const amount = unit * rate;
  const transactionId = newId();

  if (cashAccountId == null) {
    await db.execute(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
       VALUES ($1, 'income', $2, NULL, $3, NULL, $4, NULL, $5)`,
      [transactionId, amount, forexAccountId, note, date]
    );
  } else {
    await db.execute(
      `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date)
       VALUES ($1, 'transfer', $2, NULL, $3, $4, $5, NULL, $6)`,
      [transactionId, amount, cashAccountId, forexAccountId, note, date]
    );
  }

  const purchaseId = newId();
  await db.execute(
    `INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [purchaseId, forexAccountId, transactionId, unit, rate, date]
  );

  return { transactionId, purchaseId };
}
