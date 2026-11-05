import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { formatCurrency } from "@/lib/utils";
import { breakdownRowKey, toBreakdownChartData } from "../shared/breakdown-chart-data";
import { BreakdownPie } from "../shared/breakdown-pie";
import { useBalancesByAccountType } from "./use-balances-by-account-type";

// Palet sama dengan desktop (account-type/index.tsx).
const ACCOUNT_TYPE_COLORS = ["#2563eb", "#f97316", "#22c55e", "#eab308", "#a855f7", "#ec4899"];

export function AccountTypeSection() {
  const { data: balances, isLoading } = useBalancesByAccountType();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { rows } = toBreakdownChartData(
    balances.map((row) => ({
      ...row,
      group_key: row.account_type,
      label: ACCOUNT_TYPE_OPTIONS[row.account_type]?.label ?? row.account_type,
    })),
    ACCOUNT_TYPE_COLORS
  );

  if (isLoading) {
    return (
      <View className="gap-4">
        <View className="h-[180px] items-center justify-center rounded-lg border border-neutral-200 p-3">
          <Skeleton className="size-[150px] rounded-full" />
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} className="gap-2 rounded-lg border border-neutral-200 p-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-20" />
          </View>
        ))}
      </View>
    );
  }

  if (rows.length === 0) {
    return <Text className="text-sm text-neutral-500">Belum ada akun.</Text>;
  }

  return (
    <View className="gap-4">
      <View className="rounded-lg border border-neutral-200 p-3">
        <BreakdownPie rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />
      </View>

      {rows.map((row) => {
        // Unrealized P/L hanya untuk investasi, informasional (tidak masuk total/pie).
        const pl = row.total_market_value != null ? row.total_market_value - row.total : null;
        const key = breakdownRowKey(row);
        const isSelected = key === selectedKey;

        return (
          <Pressable
            key={key}
            className={`gap-1 rounded-lg border p-3 ${
              isSelected ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
            }`}
            onPress={() => setSelectedKey(isSelected ? null : key)}
          >
            <View className="flex-row items-center gap-2">
              <View className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              <Text className="text-sm text-neutral-500">{row.label}</Text>
            </View>
            <Text className="text-2xl font-semibold text-neutral-900">{formatCurrency(row.total)}</Text>
            <Text className="text-sm text-neutral-500">{row.percent.toFixed(0)}% dari total</Text>
            {pl != null && (
              <Text className={`mt-1 text-sm ${pl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                Unrealized P/L: {pl >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(pl))}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
