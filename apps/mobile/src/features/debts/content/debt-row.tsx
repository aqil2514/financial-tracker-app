import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/lib/utils";
import type { ContactDebtRow } from "@/shared/debts";
import { DEBT_STATUS_LABEL } from "../status-labels";
import { PaymentsList } from "./payments-list";

function formatDebtDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700",
  paid: "bg-neutral-100 text-neutral-600",
  written_off: "bg-amber-100 text-amber-700",
};

export function DebtRow({ debt }: { debt: ContactDebtRow }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const badgeClass = STATUS_BADGE_CLASS[debt.status] ?? "bg-neutral-100 text-neutral-600";

  return (
    <View className="rounded-md border border-neutral-200">
      <Pressable
        className="flex-row items-center justify-between gap-2 p-3"
        onPress={() => setIsExpanded((prev) => !prev)}
      >
        <View className="flex-row items-center gap-2">
          <Ionicons
            name="chevron-down"
            size={16}
            color="#737373"
            style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
          />
          <View>
            <Text className="text-sm font-medium text-neutral-900">{formatDebtDate(debt.date)}</Text>
            <Text className="text-xs text-neutral-500">{debt.account_name ?? "—"}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="items-end">
            <Text className="text-sm font-medium text-neutral-900">{formatCurrency(debt.amount)}</Text>
            <Text className="text-xs text-neutral-500">Sisa {formatCurrency(debt.remaining)}</Text>
          </View>
          <View className={`rounded-full px-2 py-0.5 ${badgeClass.split(" ")[0]}`}>
            <Text className={`text-xs font-medium ${badgeClass.split(" ")[1]}`}>
              {DEBT_STATUS_LABEL[debt.status] ?? debt.status}
            </Text>
          </View>
        </View>
      </Pressable>
      {isExpanded && (
        <View className="border-t border-neutral-100">
          <PaymentsList debtId={debt.id} />
        </View>
      )}
    </View>
  );
}
