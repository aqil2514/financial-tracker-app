import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { computePl, formatAgo, formatSignedCurrency, formatUnit } from "@/features/investments/content/pl";
import { StatItem } from "@/features/investments/content/stat-item";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { ForexAccountSummary } from "@/shared/forex/forex-queries";

export function ForexDetailStats({
  account,
  totalRealizedPl,
  onPressUpdateRate,
}: {
  account: ForexAccountSummary;
  totalRealizedPl: number;
  onPressUpdateRate: () => void;
}) {
  const { pl, percent, toneClass } = computePl(account.currentValue, account.balance);

  return (
    <View className="rounded-lg border border-neutral-200 bg-white px-4 py-2">
      <View className="flex-row flex-wrap">
        <StatItem label="Dipegang" value={`${formatUnit(account.remainingUnit)} ${account.currency}`} />
        <View className="w-1/2 gap-0.5 py-2 pr-2">
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-neutral-500">Kurs Terkini</Text>
            <Pressable onPress={onPressUpdateRate} hitSlop={8}>
              <Ionicons name="create-outline" size={14} color="#737373" />
            </Pressable>
          </View>
          <Text className="font-medium text-neutral-900">{formatCurrencyPrecise(account.currentRate)}</Text>
        </View>
        <StatItem label="Nilai Terkini" value={formatCurrency(account.currentValue)} />
        <StatItem label="Modal" value={formatCurrency(account.balance)} />
        <StatItem label="Unrealized P/L" value={formatSignedCurrency(pl)} toneClass={toneClass} />
        <StatItem
          label="P/L (% posisi aktif)"
          value={`${pl >= 0 ? "+" : ""}${percent.toFixed(2)}%`}
          toneClass={toneClass}
        />
        <StatItem
          label="Average Cost / unit"
          value={account.averageCost > 0 ? formatCurrencyPrecise(account.averageCost) : "—"}
        />
        <StatItem label="Kurs Diupdate" value={formatAgo(account.rateUpdatedAt)} />
        <StatItem
          label="Realized P/L"
          value={formatSignedCurrency(totalRealizedPl)}
          toneClass={totalRealizedPl >= 0 ? "text-green-700" : "text-red-700"}
        />
      </View>
    </View>
  );
}
