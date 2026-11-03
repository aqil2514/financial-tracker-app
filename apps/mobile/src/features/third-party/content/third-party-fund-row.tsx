import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/features/investments/content/pl";
import type { ThirdPartyFundHistoryRow } from "@/shared/third-party-funds";

// onPress hanya untuk baris direct (edit); baris transfer cuma bisa dihapus.
export function ThirdPartyFundRow({
  fund,
  onPress,
  onDelete,
}: {
  fund: ThirdPartyFundHistoryRow;
  onPress?: () => void;
  onDelete: () => void;
}) {
  const isIn = fund.direction === "in";
  // Baris transfer: "masuk" = dipindahkan KE kontak/akun ini, "keluar" = dipindahkan DARI sini.
  const label = fund.isTransfer ? (isIn ? "Pindah masuk" : "Pindah keluar") : isIn ? "Titip" : "Ambil";

  return (
    <Pressable
      className="flex-row items-center justify-between gap-2 rounded-md border border-neutral-200 p-3"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="flex-1 flex-row items-center gap-2">
        <Ionicons
          name={isIn ? "arrow-down-circle-outline" : "arrow-up-circle-outline"}
          size={22}
          color={isIn ? "#16a34a" : "#dc2626"}
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-medium text-neutral-900" numberOfLines={1}>
            {fund.contactName}
          </Text>
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {fund.accountName} · {formatDate(fund.date)}
          </Text>
          {fund.note ? (
            <Text className="text-xs text-neutral-500" numberOfLines={2}>
              {fund.note}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="items-end gap-1">
        <Text className={`text-sm font-medium ${isIn ? "text-green-600" : "text-red-600"}`}>
          {isIn ? "+" : "-"}
          {formatCurrency(fund.amount)}
        </Text>
        <Badge label={label} />
      </View>
      <Pressable hitSlop={8} onPress={onDelete}>
        <Ionicons name="trash-outline" size={18} color="#dc2626" />
      </Pressable>
    </Pressable>
  );
}
