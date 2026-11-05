import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { InvestmentAccountSummary } from "@/shared/investments";
import { computePl, formatAgo, formatSignedCurrency } from "./pl";
import { StatItem } from "./stat-item";

export function InvestmentPlStats({
  account,
  averageCost,
  onPressUpdateMarketValue,
}: {
  account: InvestmentAccountSummary;
  averageCost: number | null;
  onPressUpdateMarketValue: () => void;
}) {
  const { pl, percent, toneClass } = computePl(account.currentMarketValue, account.balance);

  return (
    <View className="rounded-lg border border-neutral-200 bg-white px-4 py-2">
      <View className="flex-row flex-wrap">
        <View className="w-1/2 gap-0.5 py-2 pr-2">
          <View className="flex-row items-center gap-1">
            <Text className="text-xs text-neutral-500">Nilai Pasar Terkini</Text>
            <Pressable onPress={onPressUpdateMarketValue} hitSlop={8}>
              <Ionicons name="create-outline" size={14} color="#737373" />
            </Pressable>
          </View>
          <Text className="font-medium text-neutral-900">{formatCurrency(account.currentMarketValue)}</Text>
        </View>
        <StatItem label="Unrealized P/L" value={formatSignedCurrency(pl)} toneClass={toneClass} />
        <StatItem
          label="P/L (% posisi aktif)"
          value={`${pl >= 0 ? "+" : ""}${percent.toFixed(2)}%`}
          toneClass={toneClass}
        />
        <StatItem
          label={`Average Cost / ${account.unitLabel}`}
          value={averageCost != null ? formatCurrencyPrecise(averageCost) : "—"}
        />
        <StatItem label="Nilai Pasar Diupdate" value={formatAgo(account.marketValueUpdatedAt)} />
      </View>
    </View>
  );
}
