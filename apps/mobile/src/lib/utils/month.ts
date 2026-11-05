import { toLocalDate } from "./local-datetime";

// month = "YYYY-MM"
export function currentMonth(): string {
  return toLocalDate().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Rentang tanggal kalender (YYYY-MM-DD) awal s/d akhir bulan, untuk
// dipakai dengan date(transactions.date) BETWEEN ? AND ?.
export function monthDateRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0");
  return { from: `${month}-01`, to: `${month}-${lastDay}` };
}
