import { useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/skeleton";
import { OptionPicker, type OptionPickerRef } from "@/components/query/shared/option-picker";
import { useCategoryPeriods } from "@/features/categories/period/content/use-category-periods";
import { TransactionItem } from "@/features/transactions/content/transaction-list-item";
import { formatDateLabel, groupByDate } from "@/features/transactions/utils";
import type { TransactionListItem } from "@/features/transactions/types";
import { formatCurrency, formatShortDate, MONTH_NAMES_SHORT } from "@/lib/utils";
import { BreakdownPie } from "../shared/breakdown-pie";
import { IncomeExpenseCards } from "../shared/income-expense-cards";
import { LineSeriesChart } from "../shared/line-series-chart";
import { dailyIncomeExpense, PERIOD_COLORS, summarizePeriod, toPeriodPieRows } from "./period-data";
import { useCategoryPeriodTransactions } from "./use-category-period-transactions";

type ChartType = "pie" | "line";

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "pie", label: "Pie Chart" },
  { value: "line", label: "Tren" },
];

const PAGE_SIZE = 50;

export function CategoryPeriodSection() {
  const { periods, isLoading: periodsLoading } = useCategoryPeriods();
  const pickerRef = useRef<OptionPickerRef>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>("pie");

  // Desktop memulai tanpa periode terpilih; di mobile periode pertama (yang sedang berjalan
  // diurutkan paling atas) langsung dipilih supaya layar tidak kosong.
  const period = periods.find((item) => item.id === selectedId) ?? periods[0] ?? null;
  const { data: transactions, isLoading } = useCategoryPeriodTransactions(period?.id ?? null);

  const summary = useMemo(() => summarizePeriod(transactions), [transactions]);

  if (periodsLoading && periods.length === 0) {
    return <Skeleton className="h-12 w-full" />;
  }

  if (!period) {
    return (
      <Text className="text-sm text-neutral-500">
        Belum ada periode kategori. Buat dulu lewat menu Kategori › Periode.
      </Text>
    );
  }

  return (
    <View className="gap-4">
      <Pressable
        className="flex-row items-center justify-between rounded-md border border-neutral-300 px-3 py-3"
        onPress={() => pickerRef.current?.present()}
      >
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold text-neutral-900" numberOfLines={1}>
            {period.name}
          </Text>
          <Text className="text-sm text-neutral-500">
            {formatShortDate(period.startDate)} - {formatShortDate(period.endDate)}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color="#737373" />
      </Pressable>
      <OptionPicker
        ref={pickerRef}
        title="Pilih Periode"
        searchable={periods.length > 6}
        options={periods.map((item) => ({ value: item.id, label: item.name }))}
        value={period.id}
        onSelect={setSelectedId}
      />

      <IncomeExpenseCards income={summary.income} expense={summary.expense} isLoading={isLoading} />

      <SegmentedControl options={CHART_TYPE_OPTIONS} value={chartType} onChange={setChartType} />

      {isLoading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : transactions.length === 0 ? (
        <Text className="text-sm text-neutral-500">Belum ada transaksi pada periode ini.</Text>
      ) : chartType === "pie" ? (
        <PeriodPie key={period.id} summary={summary} />
      ) : (
        <PeriodTrend transactions={transactions} />
      )}

      <View className="gap-1">
        <Text className="font-semibold text-neutral-900">Daftar Transaksi</Text>
        <Text className="text-sm text-neutral-500">Dikelompokkan per tanggal.</Text>
      </View>
      {isLoading ? (
        <View className="gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </View>
      ) : (
        <PeriodTransactionList transactions={transactions} />
      )}
    </View>
  );
}

function PeriodPie({ summary }: { summary: { income: number; expense: number } }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const rows = toPeriodPieRows(summary);

  return (
    <View className="gap-3 rounded-lg border border-neutral-200 p-3">
      <BreakdownPie rows={rows} selectedKey={selectedKey} onSelect={setSelectedKey} />

      {rows.map((row) => {
        const key = row.group_key ?? row.label;
        const isSelected = key === selectedKey;
        return (
          <Pressable
            key={key}
            className={`flex-row items-center justify-between gap-3 rounded-md border-t border-neutral-100 px-1 py-2 ${
              isSelected ? "bg-neutral-100" : ""
            }`}
            onPress={() => setSelectedKey(isSelected ? null : key)}
          >
            <View className="flex-row items-center gap-2">
              <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: row.color }}>
                <Text className="text-xs font-medium text-white">{row.percent.toFixed(0)}%</Text>
              </View>
              <Text className="text-neutral-900">{row.label}</Text>
            </View>
            <Text className="text-sm text-neutral-500">{formatCurrency(row.total)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PeriodTrend({ transactions }: { transactions: TransactionListItem[] }) {
  const daily = useMemo(() => dailyIncomeExpense(transactions), [transactions]);
  const labels = useMemo(
    () =>
      daily.dates.map((date) => {
        const [, month, day] = date.split("-").map(Number);
        return `${day} ${MONTH_NAMES_SHORT[month - 1]}`;
      }),
    [daily]
  );
  const titles = useMemo(() => daily.dates.map(formatShortDate), [daily]);
  const series = useMemo(
    () => [
      { key: "income", label: "Pemasukan", color: PERIOD_COLORS.income, values: daily.income },
      { key: "expense", label: "Pengeluaran", color: PERIOD_COLORS.expense, values: daily.expense },
    ],
    [daily]
  );

  return <LineSeriesChart labels={labels} titles={titles} series={series} showLegend />;
}

// Daftar dirender bertahap (bukan SectionList) karena berada di dalam ScrollView halaman Laporan;
// periode panjang bisa berisi ratusan transaksi.
function PeriodTransactionList({ transactions }: { transactions: TransactionListItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sections = useMemo(
    () => groupByDate(transactions.slice(0, visibleCount)),
    [transactions, visibleCount]
  );

  if (transactions.length === 0) {
    return <Text className="text-sm text-neutral-500">Tidak ada transaksi.</Text>;
  }

  return (
    <View className="gap-4">
      {sections.map((section) => (
        <View key={section.title} className="gap-2">
          <Text className="text-sm font-semibold text-neutral-500">{formatDateLabel(section.title)}</Text>
          {section.data.map((item) => (
            <TransactionItem key={item.id} transaction={item} />
          ))}
        </View>
      ))}

      {visibleCount < transactions.length && (
        <Pressable
          className="items-center rounded-md border border-neutral-300 px-4 py-3"
          onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          <Text className="font-medium text-neutral-900">
            Tampilkan lebih banyak ({transactions.length - visibleCount} lagi)
          </Text>
        </Pressable>
      )}
    </View>
  );
}
