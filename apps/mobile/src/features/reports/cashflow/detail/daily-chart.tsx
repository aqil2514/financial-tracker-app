import { useMemo } from "react";
import { Text } from "react-native";
import { formatShortDate, MONTH_NAMES_SHORT } from "@/lib/utils";
import { LineSeriesChart } from "../../shared/line-series-chart";

interface DailyChartProps {
  points: { date: string; total: number }[];
  color: string;
}

// Grafik total harian satu seri; semua gambar dan interaksinya ada di LineSeriesChart.
export function DailyChart({ points, color }: DailyChartProps) {
  const labels = useMemo(
    () =>
      points.map((point) => {
        const [, month, day] = point.date.split("-").map(Number);
        return `${day} ${MONTH_NAMES_SHORT[month - 1]}`;
      }),
    [points]
  );
  const titles = useMemo(() => points.map((point) => formatShortDate(point.date)), [points]);
  const series = useMemo(
    () => [{ key: "total", label: "Total", color, values: points.map((point) => point.total) }],
    [points, color]
  );

  if (points.length === 0) {
    return <Text className="py-6 text-center text-sm text-neutral-500">Belum ada data.</Text>;
  }

  return <LineSeriesChart labels={labels} titles={titles} series={series} />;
}
