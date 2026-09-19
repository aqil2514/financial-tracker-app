import { formatCurrency } from "@/lib/format-currency";

export function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { name: string; balance: number; percent: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="bg-popover rounded-lg border p-3 text-sm shadow-md">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground">
        {formatCurrency(row.balance, "IDR")} ({row.percent.toFixed(1)}%)
      </p>
    </div>
  );
}
