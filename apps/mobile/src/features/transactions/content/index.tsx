import { Pressable, SectionList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import type { TransactionListItem } from "./transaction-list-item";
import { useTransactions } from "./use-transactions";

const TYPE_LABEL: Record<TransactionListItem["type"], string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

const AMOUNT_COLOR: Record<TransactionListItem["type"], string> = {
  income: "text-emerald-600",
  expense: "text-red-600",
  transfer: "text-neutral-900",
};

function formatCurrency(amount: number) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDate(transactions: TransactionListItem[]) {
  const groups = new Map<string, TransactionListItem[]>();
  for (const transaction of transactions) {
    const existing = groups.get(transaction.date) ?? [];
    existing.push(transaction);
    groups.set(transaction.date, existing);
  }
  return Array.from(groups.entries()).map(([date, data]) => ({
    title: date,
    data,
  }));
}

interface TransactionListProps {
  filters?: FilterConfig[];
  sorts?: SortConfig[];
}

export function TransactionList({ filters, sorts }: TransactionListProps) {
  const { transactions, isLoading } = useTransactions({ filters, sorts });
  const sections = groupByDate(transactions);

  if (!isLoading && transactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">Belum ada transaksi.</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 pb-4"
      renderSectionHeader={({ section }) => (
        <Text className="bg-white py-2 text-sm font-semibold text-neutral-500">
          {formatDateLabel(section.title)}
        </Text>
      )}
      renderItem={({ item }) => <TransactionItem transaction={item} />}
      ItemSeparatorComponent={() => <View className="h-2" />}
      SectionSeparatorComponent={() => <View className="h-1" />}
    />
  );
}

function TransactionItem({ transaction }: { transaction: TransactionListItem }) {
  const router = useRouter();
  const isTransfer = transaction.type === "transfer";

  return (
    <Pressable
      className="rounded-lg border border-neutral-200 bg-white p-3"
      onPress={() =>
        router.push({ pathname: "/transactions/[id]/edit", params: { id: transaction.id } })
      }
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-medium text-neutral-900">{transaction.note}</Text>
          {transaction.description && (
            <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
              {transaction.description}
            </Text>
          )}
          <Text className="mt-1 text-xs text-neutral-500">
            {isTransfer
              ? `${transaction.account} → ${transaction.transferAccount}`
              : transaction.account}
          </Text>
        </View>
        <Text className={`font-semibold ${AMOUNT_COLOR[transaction.type]}`}>
          {transaction.type === "expense" ? "-" : transaction.type === "income" ? "+" : ""}
          {formatCurrency(transaction.amount)}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center gap-2">
        <Badge label={TYPE_LABEL[transaction.type]} />
        {transaction.category && <Badge label={transaction.category} />}
        {transaction.hasAttachment && <Badge label="📎" />}
      </View>
    </Pressable>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-neutral-100 px-2 py-0.5">
      <Text className="text-xs text-neutral-700">{label}</Text>
    </View>
  );
}
