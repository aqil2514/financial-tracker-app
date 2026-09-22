import { formatCurrency } from "@/lib/format-currency";
import { useCurrentMonthSummary } from "./use-current-month-summary";

export function SummaryStats() {
  const { data } = useCurrentMonthSummary();
  const net = (data?.income ?? 0) - (data?.expense ?? 0);

  if (!data) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <p className="text-muted-foreground text-xs">Pemasukan</p>
        <p className="font-medium text-green-600">{formatCurrency(data.income, "IDR")}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Pengeluaran</p>
        <p className="font-medium text-red-600">{formatCurrency(data.expense, "IDR")}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs">Selisih</p>
        <p className={`font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatCurrency(net, "IDR")}
        </p>
      </div>
    </div>
  );
}
