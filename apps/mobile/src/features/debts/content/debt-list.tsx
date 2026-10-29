import { FlatList, Text, View } from "react-native";
import type { DebtListRow } from "@/shared/debts";
import { DebtListItem } from "./debt-list-item";

export function DebtList({
  debts,
  isLoading,
  onPay,
  onWriteOff,
}: {
  debts: DebtListRow[];
  isLoading: boolean;
  onPay: (debt: DebtListRow) => void;
  onWriteOff: (debt: DebtListRow) => void;
}) {
  if (!isLoading && debts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-center text-neutral-500">Belum ada piutang/utang tercatat.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={debts}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-2 p-4"
      renderItem={({ item }) => <DebtListItem debt={item} onPay={onPay} onWriteOff={onWriteOff} />}
    />
  );
}
