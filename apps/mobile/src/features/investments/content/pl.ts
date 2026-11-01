import { formatCurrency } from "@/lib/utils";

export function computePl(marketValue: number, balance: number) {
  const pl = marketValue - balance;
  const percent = balance !== 0 ? (pl / balance) * 100 : 0;
  return { pl, percent, toneClass: pl >= 0 ? "text-green-700" : "text-red-700" };
}

export function formatSignedCurrency(amount: number): string {
  return `${amount >= 0 ? "+" : ""}${formatCurrency(amount)}`;
}

export function formatUnit(value: number): string {
  return value.toLocaleString("id-ID", { maximumFractionDigits: 4 });
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function formatAgo(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}
