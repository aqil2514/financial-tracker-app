"use client";

import { useAccountDetail } from "../detail-context";
import { useAccountMonthTransactions } from "./use-account-month-transactions";
import { TransactionList } from "./transaction-list";

/** Transaksi akun ini pada bulan yang sama dengan chart di sisi kiri
 * (selectedMonth dari context) — geser bulan lewat MonthPicker di kiri
 * ikut mengubah daftar di tab ini. */
export function MonthTab({ accountId }: { accountId: number }) {
  const { selectedMonth } = useAccountDetail();
  const { data: transactions } = useAccountMonthTransactions(accountId, selectedMonth);
  return <TransactionList transactions={transactions} accountId={accountId} />;
}
