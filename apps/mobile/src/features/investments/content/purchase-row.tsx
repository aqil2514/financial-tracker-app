import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { InvestmentPurchaseRow } from "@/shared/investments";
import { formatDate, formatUnit } from "./pl";
import { StatusBadge } from "./status-badge";

export function PurchaseRow({
  purchase,
  unitLabel,
  onPress,
}: {
  purchase: InvestmentPurchaseRow;
  unitLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 p-3"
      onPress={onPress}
    >
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-neutral-900">{formatDate(purchase.date)}</Text>
        <Text className="text-xs text-neutral-500">
          {formatUnit(purchase.unit)} {unitLabel} × {purchase.pricePerUnit != null ? formatCurrencyPrecise(purchase.pricePerUnit) : "—"}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="items-end gap-1">
          <Text className="text-sm font-medium text-neutral-900">{formatCurrency(purchase.amount)}</Text>
          <View className="flex-row gap-1">
            {purchase.isDirect && <Badge label="Langsung" />}
            <StatusBadge status={purchase.status} />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#a3a3a3" />
      </View>
    </Pressable>
  );
}
