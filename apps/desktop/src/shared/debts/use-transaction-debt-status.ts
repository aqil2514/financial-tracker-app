import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export type TransactionDebtStatus =
  /** Belum pernah trigger apa pun — semua field bebas diedit, kalau
   * match kondisi debt setelah diedit, applyDebtTransaction dijalankan
   * seperti create. */
  | { role: "none" }
  /** Transaksi ini yang MEMBUAT sebuah `debts` (pokok piutang/utang).
   * `hasPayments` = piutang itu SUDAH menerima cicilan dari transaksi
   * LAIN — kalau true, field "berbahaya" (amount/akun/kontak/dst) HARUS
   * dikunci karena recreate akan menghapus cicilan itu lewat CASCADE. */
  | { role: "principal"; debtId: string; hasPayments: boolean }
  /** Transaksi ini adalah SATU cicilan/pelunasan (`debt_payments`) —
   * recreate selalu aman, tidak ada yang bergantung padanya. */
  | { role: "payment"; debtPaymentId: string; debtId: string };

/**
 * Query murni (BUKAN hook) -- `db` diterima sbg parameter (BUKAN
 * `getDb()` dipanggil di dalam), pola SAMA dgn `apply-debt-transaction.ts`
 * supaya satu `mutationFn` (mis. `useDeleteTransaction`) bisa reuse 1
 * koneksi/transaksi DB yang sama utk beberapa query/execute berurutan,
 * bukan buka koneksi baru tiap panggil fungsi. `useTransactionDebtStatus`
 * (hook) di bawah cuma wrapper `useQuery` tipis di atas fungsi ini --
 * satu sumber logic.
 */
export async function getTransactionDebtStatus(db: Db, transactionId: string): Promise<TransactionDebtStatus> {
  const asPrincipal = await db.select<{ id: string }[]>(
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

  const asPayment = await db.select<{ id: string; debt_id: string }[]>(
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
}

/**
 * Peran transaksi ini terhadap `debts`/`debt_payments` (lihat "Deteksi
 * otomatis debts dari transfer" dan "Edit transaksi yang sudah py debts
 * terkait" di debt-receivable-tracking.md) — menentukan field mana yang
 * boleh diedit bebas dan strategi apa (recreate/update/lock) yang dipakai
 * `applyDebtTransactionEdit()` saat submit.
 */
export function useTransactionDebtStatus(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["debts", "transaction-status", transactionId],
    queryFn: async () => {
      const db = await getDb();
      return getTransactionDebtStatus(db, transactionId as string);
    },
    enabled: transactionId != null,
  });
}
