import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

export type TransactionInvestmentPurchase = { id: string; unit: number; price_per_unit: number } | null;

// Base key -- didaftarkan di QUERY_DEPENDENCIES (lib/query-dependencies.ts)
// domain "transactions", supaya ikut di-invalidate begitu
// applyInvestmentTransactionEdit menulis ulang investment_purchases saat
// transaksi diedit (lihat use-investment-account.ts untuk alasan yang
// sama -- bug nyata: tanpa ini, edit transaksi investasi berulang
// menampilkan nilai BASI dari render/mutation sebelumnya di form berikutnya).
export const transactionInvestmentPurchaseQueryKey = ["investment_purchases", "transaction"];

/**
 * Query murni (BUKAN hook) — pola sama `getTransactionDebtStatus`
 * (use-transaction-debt-status.ts), supaya satu `mutationFn` bisa reuse
 * koneksi DB yang sama. Dipakai untuk prefill field unit/harga saat edit
 * transaksi (lihat use-update-transaction.ts) — beda dari debt_action
 * yang direset kosong, field ini data historis yang harus tampil apa
 * adanya supaya user bisa edit (lihat docs/concept/konsep-investasi.md
 * bagian "Settlement tertunda": user mengedit baris manual saat
 * settlement dikonfirmasi).
 */
export async function getTransactionInvestmentPurchase(
  db: Db,
  transactionId: string
): Promise<TransactionInvestmentPurchase> {
  const rows = await db.select<{ id: string; unit: number; price_per_unit: number }[]>(
    "SELECT id, unit, price_per_unit FROM investment_purchases WHERE transaction_id = $1 LIMIT 1",
    [transactionId]
  );
  return rows[0] ?? null;
}

export function useTransactionInvestmentPurchase(transactionId: string | undefined) {
  return useQuery({
    queryKey: [...transactionInvestmentPurchaseQueryKey, transactionId],
    queryFn: async () => {
      const db = await getDb();
      return getTransactionInvestmentPurchase(db, transactionId as string);
    },
    enabled: transactionId != null,
  });
}
