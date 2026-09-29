import { useQuery } from "@tanstack/react-query";
import { getDb, type DebtPayment } from "@/lib/db";

export const debtPaymentsQueryKey = ["debts", "payments"];

export type DebtPaymentRow = DebtPayment & {
  account_name: string | null;
};

/** Riwayat cicilan/pelunasan SATU `debts` — dipakai baris expandable di
 * dialog detail kontak (features/debts-summary/content/card/detail/),
 * lazy-fetch saat baris di-expand (bukan sekaligus semua debt sebuah
 * kontak) lewat opsi `enabled`. */
export function useDebtPayments(debtId: string | undefined) {
  return useQuery({
    queryKey: [...debtPaymentsQueryKey, debtId],
    enabled: debtId != null,
    queryFn: async (): Promise<DebtPaymentRow[]> => {
      const db = await getDb();
      return db.select<DebtPaymentRow[]>(
        `SELECT
           debt_payments.*,
           accounts.name AS account_name
         FROM debt_payments
         LEFT JOIN accounts ON accounts.id = debt_payments.account_id
         WHERE debt_payments.debt_id = $1
         ORDER BY debt_payments.date DESC, debt_payments.id DESC`,
        [debtId]
      );
    },
  });
}
