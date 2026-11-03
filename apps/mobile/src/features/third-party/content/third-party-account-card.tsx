import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { formatCurrency } from "@/lib/utils";
import type { ThirdPartyAccountSummary } from "@/shared/third-party-funds";

export function ThirdPartyAccountCard({ account }: { account: ThirdPartyAccountSummary }) {
  return (
    <View className="gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Ionicons name="people-outline" size={18} color="#171717" />
          <Text className="flex-1 font-medium text-neutral-900" numberOfLines={1}>
            {account.name}
          </Text>
        </View>
        <Text className="font-medium text-neutral-900">{formatCurrency(account.balance)}</Text>
      </View>
      {(account.groupName || !account.isActive) && (
        <View className="flex-row flex-wrap gap-1">
          {account.groupName && <Badge label={account.groupName} />}
          {!account.isActive && <Badge label="Nonaktif" />}
        </View>
      )}
    </View>
  );
}
