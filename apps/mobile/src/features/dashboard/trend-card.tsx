import { Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { MonthlyBarChart } from "./monthly-bar-chart";
import { useMonthlySummary } from "./use-monthly-summary";

const MONTHS = 6;

export function TrendCard() {
  const { data, isLoading } = useMonthlySummary(MONTHS);
  const isEmpty = data.every((row) => row.income === 0 && row.expense === 0);

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-neutral-500">Tren {MONTHS} Bulan Terakhir</Text>
      {isLoading ? (
        <Skeleton className="h-[200px] w-full rounded-lg" />
      ) : isEmpty ? (
        <Text className="text-sm text-neutral-500">Belum ada data.</Text>
      ) : (
        <>
          <MonthlyBarChart rows={data} />
          <View className="flex-row items-center justify-center gap-4">
            <Legend color="#16a34a" label="Pemasukan" />
            <Legend color="#dc2626" label="Pengeluaran" />
          </View>
        </>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-neutral-600">{label}</Text>
    </View>
  );
}
