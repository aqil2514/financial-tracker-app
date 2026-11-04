import type { FilterConfig } from "@/components/query/filters/filter.interface";

const DATE_FILTER_KEY = "date";

// `transactions.date` adalah datetime ISO penuh — satu tanggal kalender
// (YYYY-MM-DD) harus dicocokkan sebagai rentang [00:00:00, 23:59:59],
// bukan exact match string.
export function buildDateFilter(dateKey: string): FilterConfig {
  return {
    filterKey: DATE_FILTER_KEY,
    filterOperator: "between",
    filterValue: { from: `${dateKey}T00:00:00`, to: `${dateKey}T23:59:59` },
  };
}

// month = "YYYY-MM". Rentang awal bulan s/d akhir bulan, sama seperti
// filter satu hari di atas.
export function buildMonthFilter(month: string): FilterConfig {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = String(new Date(year, monthNumber, 0).getDate()).padStart(2, "0");
  return {
    filterKey: DATE_FILTER_KEY,
    filterOperator: "between",
    filterValue: { from: `${month}-01T00:00:00`, to: `${month}-${lastDay}T23:59:59` },
  };
}

// Bulan dan hari BUKAN bagian dari `filters` milik panel Filter (panel
// tidak punya konfigurasi untuk key "date", jadi barisnya tidak bisa
// dirender) — keduanya state terpisah dan digabung di sini. Hari (dari
// tab Kalender) menang atas bulan; month null = semua waktu.
export function withDateScope(
  filters: FilterConfig[],
  month: string | null,
  day: string | null
): FilterConfig[] {
  if (day) return [...filters, buildDateFilter(day)];
  if (month) return [...filters, buildMonthFilter(month)];
  return filters;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
