import { formatCurrency } from "@/lib/format-currency";

export function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { month: string; income: number; expense: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.month}</p>
      <p className="text-green-600">Pemasukan: {formatCurrency(row.income, "IDR")}</p>
      <p className="text-red-600">Pengeluaran: {formatCurrency(row.expense, "IDR")}</p>
    </div>
  );
}
