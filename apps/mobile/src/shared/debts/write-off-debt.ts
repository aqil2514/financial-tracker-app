import { generateId } from "@/lib/database/generate-id";
import type { Db } from "./types";

export type WriteOffDebtInput = {
  db: Db;
  debtId: string;
  type: "receivable" | "payable";
  accountId: string;
  remaining: number;
};

// Tandai piutang/utang status='written_off' — kasus "dihapuskan" yang
// BUKAN pelunasan penuh (mis. diikhlaskan). Saldo akun debt TETAP
// dibawa ke nol, PERSIS seperti pelunasan — bedanya bukan transfer dari
// akun kas, melainkan transaksi expense (receivable)/income (payable)
// LANGSUNG pada akun debt itu sendiri, is_cash_neutral=1 (administratif,
// bukan uang riil berpindah). Satu baris debt_payments dibuat sebesar
// sisa, supaya remaining otomatis jadi 0 — sama pola dengan pelunasan
// penuh biasa. Pola sama seperti use-write-off-debt.ts desktop.
export async function writeOffDebt({ db, debtId, type, accountId, remaining }: WriteOffDebtInput): Promise<void> {
  if (remaining <= 0) return;

  const transactionId = generateId();
  const transactionType = type === "receivable" ? "expense" : "income";

  await db.runAsync(
    `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id, is_cash_neutral)
     VALUES (?, ?, NULL, ?, ?, datetime('now'), NULL, ?, NULL, 1)`,
    [transactionId, "Penutup piutang/utang dihapuskan", transactionType, remaining, accountId]
  );

  const paymentId = generateId();
  await db.runAsync(
    `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [paymentId, debtId, remaining, accountId, transactionId]
  );

  await db.runAsync("UPDATE debts SET status = 'written_off' WHERE id = ?", [debtId]);
}
