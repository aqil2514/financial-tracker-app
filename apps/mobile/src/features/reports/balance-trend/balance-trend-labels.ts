import { MONTH_NAMES_SHORT } from "@/lib/utils";
import type { Granularity } from "./balance-trend-query";

const MONTH_NAMES_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Label singkat di sumbu-X (sama dengan desktop): "05 Okt", "M40 '26", "Okt 26", "2026".
export function formatPointLabel(label: string, granularity: Granularity): string {
  if (granularity === "day") {
    const [, month, day] = label.split("-");
    return `${day} ${MONTH_NAMES_SHORT[Number(month) - 1]}`;
  }
  if (granularity === "month") {
    const [year, month] = label.split("-");
    return `${MONTH_NAMES_SHORT[Number(month) - 1]} ${year.slice(2)}`;
  }
  if (granularity === "year") return label;

  const [year, week] = label.split("-");
  return `M${Number(week)} '${year.slice(2)}`;
}

// Label lengkap di tooltip.
export function formatPointTooltip(label: string, granularity: Granularity): string {
  if (granularity === "day") {
    const [year, month, day] = label.split("-");
    return `${Number(day)} ${MONTH_NAMES_SHORT[Number(month) - 1]} ${year}`;
  }
  if (granularity === "month") {
    const [year, month] = label.split("-");
    return `${MONTH_NAMES_LONG[Number(month) - 1]} ${year}`;
  }
  if (granularity === "year") return label;

  const [year, week] = label.split("-");
  return `Minggu ${Number(week)}, ${year}`;
}
