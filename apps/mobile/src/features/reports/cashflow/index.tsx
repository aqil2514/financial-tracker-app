import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { monthDateRange } from "@/lib/utils";
import { CashflowColumn } from "./cashflow-column";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import { useCashflowBreakdown, type CashflowGroupBy } from "./use-cashflow-breakdown";
import { useCashflowSummary } from "./use-cashflow-summary";

const GROUP_BY_OPTIONS: { value: CashflowGroupBy; label: string }[] = [
  { value: "account_group", label: "Grup Akun" },
  { value: "parent_category", label: "Kategori Induk" },
];

export function CashflowSection({ month }: { month: string }) {
  const { from, to } = monthDateRange(month);
  const [groupBy, setGroupBy] = useState<CashflowGroupBy>("account_group");

  const { data: summary, isLoading: summaryLoading } = useCashflowSummary(from, to);
  const { data: expenseRows, isLoading: expenseLoading } = useCashflowBreakdown(from, to, "expense", groupBy);
  const { data: incomeRows, isLoading: incomeLoading } = useCashflowBreakdown(from, to, "income", groupBy);

  return (
    <View className="gap-4">
      <CashflowSummaryCards
        income={summary.income}
        expense={summary.expense}
        isLoading={summaryLoading}
      />

      <View className="flex-row self-start overflow-hidden rounded-md border border-neutral-300">
        {GROUP_BY_OPTIONS.map((option) => {
          const isActive = option.value === groupBy;
          return (
            <Pressable
              key={option.value}
              className={isActive ? "bg-neutral-900 px-3 py-2" : "px-3 py-2"}
              onPress={() => setGroupBy(option.value)}
            >
              <Text className={isActive ? "text-white" : "text-neutral-900"}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <CashflowColumn title="Pengeluaran" rows={expenseRows} isLoading={expenseLoading} />
      <CashflowColumn title="Pemasukan" rows={incomeRows} isLoading={incomeLoading} />
    </View>
  );
}
