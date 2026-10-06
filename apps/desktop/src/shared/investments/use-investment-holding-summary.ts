import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { getAverageCostPerUnit, getRemainingUnit } from "./investment-holding-math";

export type InvestmentHoldingSummary = {
  /** Average cost per unit SAAT INI — lihat investment-holding-math.ts
   * untuk rumus lengkap (satu-satunya sumber, dipakai juga oleh
   * apply-sell-investment-transaction.ts dan use-create-investment-sale.ts
   * supaya tidak pernah drift). */
  averageCostPerUnit: number;
  /** Sisa unit yang BISA DIJUAL saat ini — rumus KHUSUS validasi oversell,
   * BEDA dari `total_unit` (Unrealized P/L di halaman detail, yang
   * mengikutkan pending+settled). Lihat investment-holding-math.ts. */
  remainingUnit: number;
};

// Base key -- didaftarkan di QUERY_DEPENDENCIES (lib/query-dependencies.ts)
// domain "transactions", supaya ikut di-invalidate begitu
// applyInvestmentTransaction(Edit)/applySellInvestmentTransaction(Edit)
// menulis investment_purchases/investment_sales.
export const investmentHoldingSummaryQueryKey = ["investment_holding_summary"];

/**
 * Sisa unit + average cost SAAT INI milik satu akun investment — dipakai
 * `sell-investment-form.tsx` supaya user tahu batas maksimal SEBELUM
 * submit (bukan cuma ditolak sesudahnya oleh
 * InsufficientInvestmentUnitsError), lihat docs/concept/konsep-investasi.md
 * bagian "Yang masih belum diputuskan" (poin UI breakdown sisa unit).
 */
export function useInvestmentHoldingSummary(accountId: string | undefined) {
  return useQuery({
    queryKey: [...investmentHoldingSummaryQueryKey, accountId],
    enabled: accountId != null,
    queryFn: async (): Promise<InvestmentHoldingSummary> => {
      const db = await getDb();
      const [averageCostPerUnit, remainingUnit] = await Promise.all([
        getAverageCostPerUnit(db, accountId as string),
        getRemainingUnit(db, accountId as string),
      ]);

      return { averageCostPerUnit, remainingUnit };
    },
  });
}
