import { shiftMonth } from "@/lib/utils/month";

export interface MonthlySummaryRow {
  month: string;
  income: number;
  expense: number;
}

export interface MonthlyTotalRow {
  month: string;
  type: "income" | "expense";
  total: number;
}

// Selalu `months` bulan berurutan berakhir di `endMonth`; bulan tanpa transaksi diisi 0 supaya sumbu-X tidak bolong.
export function buildMonthlySummaryRows(
  rows: MonthlyTotalRow[],
  months: number,
  endMonth: string
): MonthlySummaryRow[] {
  const result: MonthlySummaryRow[] = [];
  for (let offset = months - 1; offset >= 0; offset--) {
    result.push({ month: shiftMonth(endMonth, -offset), income: 0, expense: 0 });
  }
  const byMonth = new Map(result.map((row) => [row.month, row]));
  for (const row of rows) {
    const entry = byMonth.get(row.month);
    if (entry) entry[row.type] = row.total;
  }
  return result;
}
