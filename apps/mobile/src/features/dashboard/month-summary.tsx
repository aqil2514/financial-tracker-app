import { Text, View } from "react-native";
import { currentMonth, monthDateRange } from "@/lib/utils/month";
import { useCashflowSummary } from "@/features/reports/cashflow/use-cashflow-summary";
import { IncomeExpenseCards } from "@/features/reports/shared/income-expense-cards";

export function MonthSummary() {
  const { from, to } = monthDateRange(currentMonth());
  const { data, isLoading } = useCashflowSummary(from, to);

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-neutral-500">Bulan Ini</Text>
      <IncomeExpenseCards income={data.income} expense={data.expense} isLoading={isLoading} />
    </View>
  );
}
