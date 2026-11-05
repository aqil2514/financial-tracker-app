import { Dimensions } from "react-native";
import { PieChart } from "react-native-chart-kit";
import type { BreakdownChartRow } from "./breakdown-chart-data";

// Layar - padding halaman (p-4 x2) - padding kartu (p-3 x2).
const CHART_WIDTH = Dimensions.get("window").width - 32 - 24;

// PieChart tidak bisa menggambar nilai negatif (mis. saldo utang), jadi
// hanya baris bertotal positif yang masuk ke pie; angka tiap baris tetap
// ditampilkan penuh di daftar pemanggil.
export function BreakdownPie({ rows }: { rows: BreakdownChartRow[] }) {
  const positive = rows.filter((row) => row.total > 0);
  if (positive.length === 0) return null;

  return (
    <PieChart
      data={positive.map((row) => ({
        name: row.label,
        population: row.total,
        color: row.color,
        legendFontColor: "#171717",
        legendFontSize: 12,
      }))}
      width={CHART_WIDTH}
      height={180}
      chartConfig={{ color: (opacity = 1) => `rgba(23, 23, 23, ${opacity})` }}
      accessor="population"
      backgroundColor="transparent"
      paddingLeft={String(CHART_WIDTH / 4)}
      hasLegend={false}
    />
  );
}
