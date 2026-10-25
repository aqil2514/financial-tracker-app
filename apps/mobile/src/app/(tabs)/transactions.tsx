import { View } from "react-native";
import { TransactionHeader } from "@/features/transactions/header";
import { TransactionList } from "@/features/transactions/content";

export default function TransactionsPage() {
  return (
    <View className="flex-1 bg-white">
      <TransactionHeader />
      <TransactionList />
    </View>
  );
}
