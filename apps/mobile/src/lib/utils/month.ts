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

export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

// "2026-11-04" -> "4 Nov 2026" (tanpa zona waktu, aman untuk tanggal kalender polos).
export function formatShortDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${day} ${MONTH_NAMES_SHORT[month - 1]} ${year}`;
}
