import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { SegmentedControl } from "@/components/segmented-control";
import { monthDateRange } from "@/lib/utils";
import { CashflowColumn } from "./cashflow-column";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import {
  useCashflowBreakdown,
  type CashflowBreakdownRow,
  type CashflowGroupBy,
} from "./use-cashflow-breakdown";
import { useCashflowSummary } from "./use-cashflow-summary";

const GROUP_BY_OPTIONS: { value: CashflowGroupBy; label: string }[] = [
  { value: "account_group", label: "Grup Akun" },
  { value: "parent_category", label: "Kategori Induk" },
];

export function CashflowSection({ month }: { month: string }) {
  const { from, to } = monthDateRange(month);
  const [groupBy, setGroupBy] = useState<CashflowGroupBy>("account_group");
  const router = useRouter();

  function openDetail(type: "income" | "expense", row: CashflowBreakdownRow) {
    router.push({
      pathname: "/reports/cashflow-detail",
      params: { type, groupBy, groupKey: row.group_key ?? "", label: row.label, month },
    });
  }

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

      <SegmentedControl options={GROUP_BY_OPTIONS} value={groupBy} onChange={setGroupBy} />

      <CashflowColumn
        title="Pengeluaran"
        rows={expenseRows}
        isLoading={expenseLoading}
        onRowPress={(row) => openDetail("expense", row)}
      />
      <CashflowColumn
        title="Pemasukan"
        rows={incomeRows}
        isLoading={incomeLoading}
        onRowPress={(row) => openDetail("income", row)}
      />
    </View>
  );
}
