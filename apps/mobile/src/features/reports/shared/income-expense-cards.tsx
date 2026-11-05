import { Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { formatCurrency } from "@/lib/utils";
interface IncomeExpenseCardsProps {
  income: number;
  expense: number;
  isLoading: boolean;
}

// Kartu Pemasukan / Pengeluaran / Surplus-Defisit, dipakai Cashflow dan Periode Kategori.
export function IncomeExpenseCards({ income, expense, isLoading }: IncomeExpenseCardsProps) {
  if (isLoading) {
    return (
      <View className="flex-row gap-2">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-2 rounded-lg border border-neutral-200 p-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-full" />
          </View>
        ))}
      </View>
    );
  }

  const net = income - expense;
  const isSurplus = net >= 0;

  return (
    <View className="flex-row gap-2">
      <SummaryCard label="Pemasukan" value={formatCurrency(income)} tone="text-emerald-600" />
      <SummaryCard label="Pengeluaran" value={formatCurrency(expense)} tone="text-red-600" />
      <SummaryCard
        label={isSurplus ? "Surplus" : "Defisit"}
        value={`${isSurplus ? "+" : "-"}${formatCurrency(Math.abs(net))}`}
        tone={isSurplus ? "text-emerald-600" : "text-red-600"}
      />
    </View>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View className="flex-1 gap-1 rounded-lg border border-neutral-200 p-3">
      <Text className="text-xs text-neutral-500">{label}</Text>
      <Text className={`font-semibold ${tone}`} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
