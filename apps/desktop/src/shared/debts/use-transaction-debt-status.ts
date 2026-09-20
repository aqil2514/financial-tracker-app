import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type TransactionDebtStatus =
  /** Belum pernah trigger apa pun — semua field bebas diedit, kalau
   * match kondisi debt setelah diedit, applyDebtTransaction dijalankan
   * seperti create. */
  | { role: "none" }
  /** Transaksi ini yang MEMBUAT sebuah `debts` (pokok piutang/utang).
   * `hasPayments` = piutang itu SUDAH menerima cicilan dari transaksi
   * LAIN — kalau true, field "berbahaya" (amount/akun/kontak/dst) HARUS
   * dikunci karena recreate akan menghapus cicilan itu lewat CASCADE. */
  | { role: "principal"; debtId: number; hasPayments: boolean }
  /** Transaksi ini adalah SATU cicilan/pelunasan (`debt_payments`) —
   * recreate selalu aman, tidak ada yang bergantung padanya. */
  | { role: "payment"; debtPaymentId: number; debtId: number };

/**
 * Peran transaksi ini terhadap `debts`/`debt_payments` (lihat "Deteksi
 * otomatis debts dari transfer" dan "Edit transaksi yang sudah py debts
 * terkait" di debt-receivable-tracking.md) — menentukan field mana yang
 * boleh diedit bebas dan strategi apa (recreate/update/lock) yang dipakai
 * `applyDebtTransactionEdit()` saat submit.
 */
export function useTransactionDebtStatus(transactionId: number | undefined) {
  return useQuery({
    queryKey: ["debts", "transaction-status", transactionId],
    queryFn: async (): Promise<TransactionDebtStatus> => {
      const db = await getDb();

      const asPrincipal = await db.select<{ id: number }[]>(
        "SELECT id FROM debts WHERE transaction_id = $1 LIMIT 1",
        [transactionId]
      );
      if (asPrincipal.length > 0) {
        const debtId = asPrincipal[0].id;
        const payments = await db.select<{ found: number }[]>(
          "SELECT EXISTS(SELECT 1 FROM debt_payments WHERE debt_id = $1) AS found",
          [debtId]
        );
        return { role: "principal", debtId, hasPayments: payments[0]?.found === 1 };
      }

      const asPayment = await db.select<{ id: number; debt_id: number }[]>(
        "SELECT id, debt_id FROM debt_payments WHERE transaction_id = $1 LIMIT 1",
        [transactionId]
      );
      if (asPayment.length > 0) {
        return {
          role: "payment",
          debtPaymentId: asPayment[0].id,
          debtId: asPayment[0].debt_id,
        };
      }

      return { role: "none" };
    },
    enabled: transactionId != null,
  });
}
