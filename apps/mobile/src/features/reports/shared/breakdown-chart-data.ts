// Palet sama dengan desktop (cashflow-column.tsx).
export const BREAKDOWN_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#facc15",
  "#84cc16",
  "#22c55e",
  "#38bdf8",
];

export interface BreakdownInputRow {
  group_key: string | null;
  label: string;
  total: number;
}

export interface BreakdownChartRow extends BreakdownInputRow {
  percent: number;
  color: string;
}

// Kunci stabil sebuah baris untuk pilihan/React key; group_key null = bucket "Tanpa ...".
export function breakdownRowKey(row: BreakdownInputRow): string {
  return row.group_key ?? row.label;
}

export function toBreakdownChartData<T extends BreakdownInputRow>(
  rows: T[],
  palette: string[] = BREAKDOWN_COLORS
): {
  total: number;
  rows: (T & { percent: number; color: string })[];
} {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    total,
    rows: rows.map((row, index) => ({
      ...row,
      percent: total > 0 ? (row.total / total) * 100 : 0,
      color: palette[index % palette.length],
    })),
  };
}
