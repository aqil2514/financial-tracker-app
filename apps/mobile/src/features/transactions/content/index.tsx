import { SectionList, Text, View } from "react-native";
import { DUMMY_TRANSACTIONS, type DummyTransaction } from "./dummy-data";

const TYPE_LABEL: Record<DummyTransaction["type"], string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

const AMOUNT_COLOR: Record<DummyTransaction["type"], string> = {
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

function groupByDate(transactions: DummyTransaction[]) {
  const groups = new Map<string, DummyTransaction[]>();
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

export function TransactionList() {
  const sections = groupByDate(DUMMY_TRANSACTIONS);

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

function TransactionItem({ transaction }: { transaction: DummyTransaction }) {
  const isTransfer = transaction.type === "transfer";

  return (
    <View className="rounded-lg border border-neutral-200 bg-white p-3">
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
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-neutral-100 px-2 py-0.5">
      <Text className="text-xs text-neutral-700">{label}</Text>
    </View>
  );
}
