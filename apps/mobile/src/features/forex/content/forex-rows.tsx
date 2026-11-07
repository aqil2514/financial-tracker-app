import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { formatDate, formatSignedCurrency, formatUnit } from "@/features/investments/content/pl";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import type { ForexPurchaseRow, ForexSaleRow } from "@/shared/forex/forex-queries";

// Mengetuk baris membuka transaksinya: lihat dan hapus di sana (riwayat valas ikut terhapus bersamanya).
export function ForexPurchaseRowItem({
  purchase,
  currency,
  onPress,
}: {
  purchase: ForexPurchaseRow;
  currency: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 p-3"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-neutral-900">{formatDate(purchase.date)}</Text>
        <Text className="text-xs text-neutral-500">
          {formatUnit(purchase.unit)} {currency} × {formatCurrencyPrecise(purchase.rate)}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="items-end gap-1">
          <Text className="text-sm font-medium text-neutral-900">{formatCurrency(purchase.amount)}</Text>
          {purchase.isDirect && <Badge label="Langsung" />}
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color="#a3a3a3" />}
      </View>
    </Pressable>
  );
}

export function ForexSaleRowItem({
  sale,
  currency,
  onPress,
}: {
  sale: ForexSaleRow;
  currency: string;
  onPress?: () => void;
}) {
  const toneClass = sale.realizedPl >= 0 ? "text-green-700" : "text-red-700";

  return (
    <Pressable
      className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 p-3"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-neutral-900">{formatDate(sale.date)}</Text>
        <Text className="text-xs text-neutral-500">
          {formatUnit(sale.unit)} {currency} × {formatCurrencyPrecise(sale.rate)}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="items-end gap-0.5">
          <Text className={`text-sm font-medium ${toneClass}`}>{formatSignedCurrency(sale.realizedPl)}</Text>
          <Text className="text-xs text-neutral-500">Average cost {formatCurrencyPrecise(sale.averageCost)}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color="#a3a3a3" />}
      </View>
    </Pressable>
  );
}
