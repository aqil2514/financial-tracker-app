"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { useInvestmentPurchases } from "@/shared/investments/use-investment-purchases";

/** Breakdown dana dari `investment_purchases`: total `pending`, `settled`,
 * dan dana yang belum diketahui nilainya -- murni presentasi, TIDAK
 * mengubah cara hitung `accounts.balance` (itu tetap murni dari
 * `transactions`). Lihat docs/concept/konsep-investasi.md bagian
 * "Settlement tertunda".
 *
 * Baris dengan `unit`/`price_per_unit` NULL (order masih diproses, lihat
 * migrasi 0038) TIDAK bisa dihitung nilainya -- ditampilkan terpisah
 * sebagai "Belum diketahui nilainya" alih-alih diam-diam dihilangkan dari
 * total, supaya breakdown tetap transparan (gabungan SEMUA kategori =
 * `balance` akun ini). */
export function SettlementBreakdown({ accountId }: { accountId: string }) {
  const { data: purchases } = useInvestmentPurchases(accountId);

  if (!purchases || purchases.length === 0) return null;

  const valued = purchases.filter((p) => p.unit != null && p.price_per_unit != null);
  const unvalued = purchases.filter((p) => p.unit == null || p.price_per_unit == null);

  const pending = valued
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.unit! * p.price_per_unit!, 0);
  const settled = valued
    .filter((p) => p.status === "settled")
    .reduce((sum, p) => sum + p.unit! * p.price_per_unit!, 0);

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">Pending</p>
            <p className="font-medium">{formatCurrency(pending, "IDR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Settled</p>
            <p className="font-medium">{formatCurrency(settled, "IDR")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="font-medium">{formatCurrency(pending + settled, "IDR")}</p>
          </div>
          {unvalued.length > 0 && (
            <div>
              <p className="text-muted-foreground text-xs">Belum Diketahui Nilainya</p>
              <p className="font-medium">
                {unvalued.length} transaksi
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
