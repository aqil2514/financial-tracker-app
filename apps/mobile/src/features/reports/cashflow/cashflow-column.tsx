import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { formatCurrency } from "@/lib/utils";
import { breakdownRowKey, toBreakdownChartData } from "../shared/breakdown-chart-data";
import { BreakdownPie } from "../shared/breakdown-pie";
import type { CashflowBreakdownRow } from "./use-cashflow-breakdown";

interface CashflowColumnProps {
  title: string;
  rows: CashflowBreakdownRow[];
  isLoading: boolean;
  onRowPress: (row: CashflowBreakdownRow) => void;
}

export function CashflowColumn({ title, rows, isLoading, onRowPress }: CashflowColumnProps) {
  const { total, rows: chartRows } = toBreakdownChartData(rows);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (isLoading) {
    return (
      <View className="gap-3 rounded-lg border border-neutral-200 p-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-neutral-500">{title}</Text>
          <Skeleton className="h-5 w-24" />
        </View>
        <View className="h-[180px] items-center justify-center">
          <Skeleton className="size-[150px] rounded-full" />
        </View>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-lg border border-neutral-200 p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-neutral-500">{title}</Text>
        <Text className="font-semibold text-neutral-900">{formatCurrency(total)}</Text>
      </View>

      {chartRows.length === 0 ? (
        <Text className="py-2 text-sm text-neutral-500">Belum ada data pada periode ini.</Text>
      ) : (
        <>
          <BreakdownPie rows={chartRows} selectedKey={selectedKey} onSelect={setSelectedKey} />

          {chartRows.map((row) => {
            const key = breakdownRowKey(row);
            const isSelected = key === selectedKey;

            return (
              <Pressable
                key={key}
                className={`flex-row items-center justify-between gap-3 rounded-md border-t border-neutral-100 px-1 py-2 ${
                  isSelected ? "bg-neutral-100" : ""
                }`}
                onPress={() => onRowPress(row)}
              >
                <View className="flex-1 flex-row items-center gap-2">
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: row.color }}>
                    <Text className="text-xs font-medium text-white">{row.percent.toFixed(0)}%</Text>
                  </View>
                  <Text className="flex-1 text-neutral-900" numberOfLines={1}>
                    {row.label}
                  </Text>
                </View>
                <Text className="text-sm text-neutral-500">{formatCurrency(row.total)}</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}
