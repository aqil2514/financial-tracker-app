import { useMemo, useState } from "react";
import { SectionList, Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { TransactionItem } from "@/features/transactions/content/transaction-list-item";
import { formatDateLabel, groupByDate } from "@/features/transactions/utils";
import { formatCurrency, monthDateRange } from "@/lib/utils";
import type { CashflowGroupBy } from "../use-cashflow-breakdown";
import { computeChildRows, dailyTotals, filterByChild, totalAmount } from "./cashflow-detail-data";
import { ChildrenFilter } from "./children-filter";
import { DailyChart } from "./daily-chart";
import { useCashflowTransactions } from "./use-cashflow-transactions";

export interface CashflowDetailTarget {
  type: "income" | "expense";
  groupBy: CashflowGroupBy;
  groupKey: string | null;
}

const CHART_COLOR = { income: "#16a34a", expense: "#dc2626" } as const;
const TYPE_LABEL = { income: "Pemasukan", expense: "Pengeluaran" } as const;

export function CashflowDetail({ target, month }: { target: CashflowDetailTarget; month: string }) {
  const { from, to } = monthDateRange(month);
  const { data: all, isLoading } = useCashflowTransactions(
    from,
    to,
    target.type,
    target.groupBy,
    target.groupKey
  );
  // Anak yang dipilih disimpan bersama bulannya; pindah bulan otomatis membatalkannya.
  const [selection, setSelection] = useState<{ month: string; childId: string | null }>({
    month,
    childId: null,
  });
  const childId = selection.month === month ? selection.childId : null;

  const childRows = useMemo(
    () => computeChildRows(all, target.groupBy, target.groupKey),
    [all, target.groupBy, target.groupKey]
  );
  const filtered = useMemo(() => filterByChild(all, target.groupBy, childId), [all, target.groupBy, childId]);
  const sections = useMemo(() => groupByDate(filtered), [filtered]);

  const header = isLoading ? (
    <View className="gap-4 pb-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-44 w-full" />
    </View>
  ) : (
    <View className="gap-4 pb-3">
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">{TYPE_LABEL[target.type]}</Text>
        <Text className="text-3xl font-semibold text-neutral-900">
          {formatCurrency(totalAmount(filtered))}
        </Text>
      </View>

      <ChildrenFilter
        options={childRows}
        value={childId}
        allTotal={totalAmount(all)}
        onChange={(next) => setSelection({ month, childId: next })}
      />

      <DailyChart points={dailyTotals(filtered)} color={CHART_COLOR[target.type]} />
    </View>
  );

  return (
    <SectionList
      sections={isLoading ? [] : sections}
      keyExtractor={(item) => item.id}
      contentContainerClassName="p-4 pb-8"
      ListHeaderComponent={header}
      ListEmptyComponent={
        isLoading ? undefined : <Text className="py-4 text-center text-neutral-500">Tidak ada transaksi.</Text>
      }
      renderSectionHeader={({ section }) => (
        <Text className="bg-white py-2 text-sm font-semibold text-neutral-500">
          {formatDateLabel(section.title)}
        </Text>
      )}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      ItemSeparatorComponent={() => <View className="h-2" />}
      SectionSeparatorComponent={() => <View className="h-1" />}
    />
  );
}
