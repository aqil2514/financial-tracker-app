import { Alert, Pressable, Text, View } from "react-native";
import { Badge } from "@/components/badge";
import { formatCurrency } from "@/lib/utils";
import type { InvestmentSaleRow } from "@/shared/investments";
import { formatDate, formatSignedCurrency, formatUnit } from "./pl";
import { StatusBadge } from "./status-badge";

export function SaleRow({ sale, unitLabel }: { sale: InvestmentSaleRow; unitLabel: string }) {
  const plToneClass = (sale.realizedPl ?? 0) >= 0 ? "text-green-700" : "text-red-700";

  return (
    <View className="gap-2 rounded-md border border-neutral-200 p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="gap-0.5">
          <Text className="text-sm font-medium text-neutral-900">{formatDate(sale.date)}</Text>
          <Text className="text-xs text-neutral-500">
            {formatUnit(sale.unit)} {unitLabel} × {formatCurrency(sale.pricePerUnit)}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className={`text-sm font-medium ${sale.realizedPl == null ? "text-neutral-500" : plToneClass}`}>
            {sale.realizedPl == null ? "P/L belum final" : formatSignedCurrency(sale.realizedPl)}
          </Text>
          <View className="flex-row gap-1">
            {sale.isWriteOff && <Badge label="Write-off" variant="expense" />}
            <StatusBadge status={sale.status} />
          </View>
        </View>
      </View>
      {sale.status === "pending" && (
        <View className="flex-row gap-2 border-t border-neutral-100 pt-2">
          <Pressable
            className="flex-1 items-center rounded-md border border-neutral-300 py-1.5"
            onPress={() => Alert.alert("Segera hadir", "Aksi Settle belum tersedia.")}
          >
            <Text className="text-sm text-neutral-900">Settle</Text>
          </Pressable>
          <Pressable
            className="flex-1 items-center rounded-md border border-red-200 py-1.5"
            onPress={() => Alert.alert("Segera hadir", "Hapus penjualan pending belum tersedia.")}
          >
            <Text className="text-sm text-red-700">Hapus</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
