import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";
import { getTransactionDebtStatus } from "./use-transaction-debt-status";

export type RelatedDebt = {
  debt: Pick<Debt, "id" | "type" | "status">;
  /** Transaksi ini membuat piutang/utangnya ("principal") atau cuma
   * cicilan/pelunasan dari piutang/utang yang sudah ada ("payment"). */
  role: "principal" | "payment";
};

/**
 * Piutang/utang yang lahir dari (atau dibayar oleh) transaksi ini, kalau
 * ada — dipakai dialog detail transaksi utk menampilkan link/ringkasan
 * ke `debts` terkait. Query dua tahap: `getTransactionDebtStatus()`
 * (shared dgn alur edit) cuma kasih id, di sini ditambah fetch
 * type/status-nya utk ditampilkan.
 */
export function useRelatedDebt(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["debts", "related-to-transaction", transactionId],
    queryFn: async (): Promise<RelatedDebt | null> => {
      const db = await getDb();
      const status = await getTransactionDebtStatus(db, transactionId as string);
      if (status.role === "none") return null;

      const rows = await db.select<Pick<Debt, "id" | "type" | "status">[]>(
        "SELECT id, type, status FROM debts WHERE id = $1",
        [status.debtId]
      );
      const debt = rows[0];
      if (!debt) return null;

      return { debt, role: status.role };
    },
    enabled: transactionId != null,
  });
}
