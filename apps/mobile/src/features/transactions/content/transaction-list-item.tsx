import { Badge } from "@/components/badge";
import { AMOUNT_COLOR, TYPE_LABEL } from "@/constants";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { TransactionListItem } from "../types";

export function TransactionItem({
  transaction,
}: {
  transaction: TransactionListItem;
}) {
  const router = useRouter();
  const isTransfer = transaction.type === "transfer";

  return (
    <Pressable
      className="rounded-lg border border-neutral-200 bg-white p-3"
      onPress={() =>
        router.push({
          pathname: "/transactions/[id]/edit",
          params: { id: transaction.id },
        })
      }
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-medium text-neutral-900">
            {transaction.note}
          </Text>
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
          {transaction.type === "expense"
            ? "-"
            : transaction.type === "income"
              ? "+"
              : ""}
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
