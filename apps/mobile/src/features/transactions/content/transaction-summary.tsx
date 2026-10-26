import { Text, View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { useTransactionSummary } from "./use-transaction-summary";

interface TransactionSummaryProps {
  filters?: FilterConfig[];
}

export function TransactionSummary({ filters }: TransactionSummaryProps) {
  const { income, expense, total } = useTransactionSummary({ filters });

  return (
    <View className="mb-3 flex-row rounded-lg border-b border-neutral-200 bg-white">
      <View className="flex-1 items-center gap-1 py-3">
        <Text className="text-xs text-neutral-500">Pemasukan</Text>
        <Text className="font-semibold text-emerald-600" numberOfLines={1}>
          {formatCurrency(income)}
        </Text>
      </View>
      <View className="w-px bg-neutral-200" />
      <View className="flex-1 items-center gap-1 py-3">
        <Text className="text-xs text-neutral-500">Pengeluaran</Text>
        <Text className="font-semibold text-red-600" numberOfLines={1}>
          {formatCurrency(expense)}
        </Text>
      </View>
      <View className="w-px bg-neutral-200" />
      <View className="flex-1 items-center gap-1 py-3">
        <Text className="text-xs text-neutral-500">Total</Text>
        <Text
          className={`font-semibold ${total < 0 ? "text-red-600" : "text-neutral-900"}`}
          numberOfLines={1}
        >
          {formatCurrency(total)}
        </Text>
      </View>
    </View>
  );
}
