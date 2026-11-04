import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionHeader } from "@/features/transactions/header";
import { TransactionList } from "@/features/transactions/content";
import { TransactionSummary } from "@/features/transactions/content/transaction-summary";
import { useTransactions } from "@/features/transactions/content/use-transactions";
import { TransactionCalendar } from "@/features/transactions/calendar";
import { TransactionTabSwitcher, type TransactionTab } from "@/features/transactions/tab-switcher";
import { withDateScope } from "@/features/transactions/utils/date-filter";
import { toLocalDate } from "@/lib/utils";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${MONTH_NAMES[month - 1]} ${year}`;
}

export default function TransactionsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TransactionTab>("daily");
  const [month, setMonth] = useState<string | null>(() => toLocalDate().slice(0, 7));
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const effectiveFilters = useMemo(() => withDateScope(filters, month, day), [filters, month, day]);
  const { transactions, isLoading } = useTransactions({ filters: effectiveFilters, sorts });

  function handleSelectDate(dateKey: string) {
    setDay(dateKey);
    setTab("daily");
  }

  // Pindah bulan membuang hari terpilih, kalau tidak hari lama (bulan
  // sebelumnya) tetap menang atas filter bulan baru.
  function handleMonthChange(next: string | null) {
    setMonth(next);
    setDay(null);
  }

  return (
    <View className="flex-1 bg-white">
      <TransactionHeader
        month={month}
        onMonthChange={handleMonthChange}
        filters={filters}
        onFiltersChange={setFilters}
        sorts={sorts}
        onSortsChange={setSorts}
      />
      <TransactionSummary filters={effectiveFilters} />
      <TransactionTabSwitcher active={tab} onChange={setTab} />

      {day && tab === "daily" && (
        <View className="flex-row px-4 pt-3">
          <Pressable
            className="flex-row items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5"
            onPress={() => setDay(null)}
          >
            <Text className="text-sm text-neutral-900">{formatDay(day)}</Text>
            <Ionicons name="close" size={16} color="#171717" />
          </Pressable>
        </View>
      )}

      {tab === "daily" ? (
        <TransactionList transactions={transactions} isLoading={isLoading} />
      ) : (
        <TransactionCalendar
          month={month ?? toLocalDate().slice(0, 7)}
          onMonthChange={handleMonthChange}
          onSelectDate={handleSelectDate}
        />
      )}

      <Pressable
        className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
        style={{ bottom: insets.bottom + 20 }}
        onPress={() => router.push("/transactions/new")}
      >
        <Text className="text-2xl text-white">+</Text>
      </Pressable>
    </View>
  );
}
