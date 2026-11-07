import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { computePl, formatSignedCurrency, formatUnit } from "@/features/investments/content/pl";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { ForexAccountSummary } from "@/shared/forex/forex-queries";

export function ForexAccountCard({ account, onPress }: { account: ForexAccountSummary; onPress: () => void }) {
  const { pl, percent, toneClass } = computePl(account.currentValue, account.balance);

  return (
    <Pressable className="gap-3 rounded-lg border border-neutral-200 bg-white p-4" onPress={onPress}>
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Ionicons name="cash-outline" size={18} color="#171717" />
          <Text className="flex-1 font-semibold text-neutral-900" numberOfLines={1}>
            {account.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#737373" />
      </View>

      <View className="flex-row flex-wrap gap-1">
        <Badge label={`${account.country} · ${account.currency}`} />
        {account.groupName && <Badge label={account.groupName} />}
        {!account.isActive && <Badge label="Nonaktif" />}
      </View>

      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-neutral-500">Dipegang</Text>
          <Text className="font-medium text-neutral-900">
            {formatUnit(account.remainingUnit)} {account.currency}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-neutral-500">Kurs Terkini</Text>
          <Text className="font-medium text-neutral-900">{formatCurrencyPrecise(account.currentRate)}</Text>
        </View>
      </View>

      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-neutral-500">Modal</Text>
          <Text className="font-medium text-neutral-900">{formatCurrency(account.balance)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-neutral-500">Nilai Terkini</Text>
          <Text className="font-medium text-neutral-900">{formatCurrency(account.currentValue)}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between border-t border-neutral-100 pt-1.5">
        <Text className="text-xs text-neutral-500">Unrealized P/L</Text>
        <Text className={`font-semibold ${toneClass}`}>
          {formatSignedCurrency(pl)} ({pl >= 0 ? "+" : ""}
          {percent.toFixed(2)}%)
        </Text>
      </View>
    </Pressable>
  );
}
