import { Text, View } from "react-native";
import { Badge } from "@/components/badge";
import { formatCurrency } from "@/lib/utils";
import type { InvestmentPurchaseRow } from "@/shared/investments";
import { formatDate, formatUnit } from "./pl";
import { StatusBadge } from "./status-badge";

export function PurchaseRow({ purchase, unitLabel }: { purchase: InvestmentPurchaseRow; unitLabel: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 p-3">
      <View className="gap-0.5">
        <Text className="text-sm font-medium text-neutral-900">{formatDate(purchase.date)}</Text>
        <Text className="text-xs text-neutral-500">
          {formatUnit(purchase.unit)} {unitLabel} × {purchase.pricePerUnit != null ? formatCurrency(purchase.pricePerUnit) : "—"}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-sm font-medium text-neutral-900">{formatCurrency(purchase.amount)}</Text>
        <View className="flex-row gap-1">
          {purchase.isDirect && <Badge label="Langsung" />}
          <StatusBadge status={purchase.status} />
        </View>
      </View>
    </View>
  );
}
