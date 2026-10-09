"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { InvestmentLabelBreakdownRow } from "@/shared/investments/aggregate-by-label";

/** Daftar ringkas P/L per LABEL jenis instrumen (scope 'account') --
 * pelengkap `InvestmentBreakdownList` (per akun individual), sejajar
 * tapi dikelompokkan per label. Beda dari breakdown per akun: tidak
 * ada navigasi klik (1 label bisa mewakili BANYAK akun sekaligus, tidak
 * ada "satu halaman detail" yang tepat utk diklik). */
export function InvestmentLabelBreakdown({ rows }: { rows: InvestmentLabelBreakdownRow[] }) {
  if (rows.length === 0) return null;

  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const plColor = row.totalPl >= 0 ? "text-green-600" : "text-red-600";

        return (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>{row.label}</span>
            <div className="text-right">
              <p>{formatCurrency(row.totalMarketValue, "IDR")}</p>
              <p className={`text-xs ${plColor}`}>
                {row.totalPl >= 0 ? "+" : ""}
                {formatCurrency(row.totalPl, "IDR")}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
