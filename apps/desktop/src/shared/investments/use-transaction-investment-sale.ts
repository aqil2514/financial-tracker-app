import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export type TransactionInvestmentSale = {
  id: string;
  unit: number;
  price_per_unit: number;
  status: "pending" | "settled";
} | null;

// Base key -- didaftarkan di QUERY_DEPENDENCIES (lib/query-dependencies.ts)
// domain "transactions", supaya ikut di-invalidate begitu
// applySellInvestmentTransactionEdit menulis ulang investment_sales saat
// transaksi diedit -- pola sama transactionInvestmentPurchaseQueryKey.
export const transactionInvestmentSaleQueryKey = ["investment_sales", "transaction"];

/**
 * Query murni (BUKAN hook) — pola sama `getTransactionInvestmentPurchase`,
 * arah sebaliknya. Dipakai untuk prefill field unit/harga saat edit
 * transaksi yang ternyata berperan sebagai PENJUALAN (beda baris dari
 * pembelian — satu transaksi transfer cuma bisa jadi salah satu, tidak
 * pernah dua-duanya, lihat use-update-transaction.ts).
 */
export async function getTransactionInvestmentSale(
  db: Db,
  transactionId: string
): Promise<TransactionInvestmentSale> {
  const rows = await db.select<
    { id: string; unit: number; price_per_unit: number; status: "pending" | "settled" }[]
  >(
    "SELECT id, unit, price_per_unit, status FROM investment_sales WHERE transaction_id = $1 LIMIT 1",
    [transactionId]
  );
  return rows[0] ?? null;
}

export function useTransactionInvestmentSale(transactionId: string | undefined) {
  return useQuery({
    queryKey: [...transactionInvestmentSaleQueryKey, transactionId],
    queryFn: async () => {
      const db = await getDb();
      return getTransactionInvestmentSale(db, transactionId as string);
    },
    enabled: transactionId != null,
  });
}
