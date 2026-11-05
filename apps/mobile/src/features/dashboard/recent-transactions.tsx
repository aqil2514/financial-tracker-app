import { Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { TransactionItem } from "@/features/transactions/content/transaction-list-item";
import { useRecentTransactions } from "./use-recent-transactions";

export function RecentTransactions() {
  const { data: transactions, isLoading } = useRecentTransactions();

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-neutral-500">Transaksi Terbaru</Text>
      {isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
      ) : transactions.length === 0 ? (
        <Text className="text-sm text-neutral-500">Belum ada transaksi.</Text>
      ) : (
        transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))
      )}
    </View>
  );
}
