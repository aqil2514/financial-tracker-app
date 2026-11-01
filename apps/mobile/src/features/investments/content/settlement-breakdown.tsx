import { Text, View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { MockPurchase } from "../mock-data";

export function SettlementBreakdown({ purchases }: { purchases: MockPurchase[] }) {
  const sumBy = (status: MockPurchase["status"]) =>
    purchases.filter((purchase) => purchase.status === status).reduce((sum, purchase) => sum + purchase.amount, 0);
  const pending = sumBy("pending");
  const settled = sumBy("settled");

  return (
    <View className="gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <Text className="font-semibold text-neutral-900">Pending vs Settled</Text>
      <View className="flex-row justify-between">
        <Text className="text-sm text-neutral-500">Pending</Text>
        <Text className="text-sm font-medium text-amber-700">{formatCurrency(pending)}</Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-sm text-neutral-500">Settled</Text>
        <Text className="text-sm font-medium text-neutral-900">{formatCurrency(settled)}</Text>
      </View>
      <View className="flex-row justify-between border-t border-neutral-100 pt-2">
        <Text className="text-sm text-neutral-500">Total</Text>
        <Text className="text-base font-semibold text-neutral-900">{formatCurrency(pending + settled)}</Text>
      </View>
    </View>
  );
}
