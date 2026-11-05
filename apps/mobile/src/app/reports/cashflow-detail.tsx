import { useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { MonthNavigator } from "@/components/month-navigator";
import { CashflowDetail } from "@/features/reports/cashflow/detail";
import type { CashflowGroupBy } from "@/features/reports/cashflow/use-cashflow-breakdown";

// Drill-down satu baris breakdown Cashflow (lihat features/reports/cashflow/index.tsx).
// groupKey kosong = bucket "Tanpa Grup"/"Tanpa Kategori".
export default function CashflowDetailPage() {
  const params = useLocalSearchParams<{
    type: "income" | "expense";
    groupBy: CashflowGroupBy;
    groupKey?: string;
    label: string;
    month: string;
  }>();
  const [month, setMonth] = useState(params.month);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          title: params.label,
          headerRight: () => (
            <MonthNavigator month={month} allowAllTime={false} onChange={(next) => next && setMonth(next)} />
          ),
        }}
      />
      <CashflowDetail
        target={{ type: params.type, groupBy: params.groupBy, groupKey: params.groupKey || null }}
        month={month}
      />
    </View>
  );
}
