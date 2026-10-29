import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/lib/utils";
import type { DebtListRow } from "@/shared/debts";
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

export function DebtListItem({
  debt,
  onPay,
  onWriteOff,
}: {
  debt: DebtListRow;
  onPay: (debt: DebtListRow) => void;
  onWriteOff: (debt: DebtListRow) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const directionClass = debt.type === "receivable" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  const directionLabel = debt.type === "receivable" ? "Piutang" : "Utang";
  const statusBadgeClass = STATUS_BADGE_CLASS[debt.status] ?? "bg-neutral-100 text-neutral-600";

  function openActions() {
    Alert.alert(
      debt.contact_name ?? directionLabel,
      undefined,
      [
        { text: debt.type === "receivable" ? "Catat Pelunasan" : "Catat Pembayaran", onPress: () => onPay(debt) },
        {
          text: "Tandai Dihapuskan",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              `Tandai ${directionLabel.toLowerCase()} ini dihapuskan?`,
              "Dipakai untuk kasus yang bukan pelunasan penuh (mis. diikhlaskan) — sisa berhenti dihitung aktif, saldo akun ikut disesuaikan ke nol. Tindakan ini tidak bisa dibatalkan.",
              [
                { text: "Batal", style: "cancel" },
                { text: "Tandai Dihapuskan", style: "destructive", onPress: () => onWriteOff(debt) },
              ]
            ),
        },
        { text: "Batal", style: "cancel" },
      ]
    );
  }

  return (
    <View className="rounded-md border border-neutral-200 bg-white">
      <Pressable
        className="flex-row items-center justify-between gap-2 p-3"
        onPress={() => setIsExpanded((prev) => !prev)}
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Ionicons
            name="chevron-down"
            size={16}
            color="#737373"
            style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
          />
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="font-medium text-neutral-900" numberOfLines={1}>
                {debt.contact_name ?? "—"}
              </Text>
              <View className={`shrink-0 rounded-full px-1.5 py-0.5 ${directionClass.split(" ")[0]}`}>
                <Text className={`text-xs font-medium ${directionClass.split(" ")[1]}`}>
                  {directionLabel}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-neutral-500">{formatDebtDate(debt.date)}</Text>
          </View>
        </View>
        <View className="items-end gap-1">
          <Text className="font-medium text-neutral-900">{formatCurrency(debt.remaining)}</Text>
          <View className={`rounded-full px-2 py-0.5 ${statusBadgeClass.split(" ")[0]}`}>
            <Text className={`text-xs font-medium ${statusBadgeClass.split(" ")[1]}`}>
              {DEBT_STATUS_LABEL[debt.status] ?? debt.status}
            </Text>
          </View>
        </View>
        {debt.status === "ongoing" && (
          <Pressable className="p-1" onPress={openActions} hitSlop={10}>
            <Ionicons name="ellipsis-vertical" size={18} color="#737373" />
          </Pressable>
        )}
      </Pressable>
      {isExpanded && (
        <View className="border-t border-neutral-100">
          <PaymentsList debtId={debt.id} />
        </View>
      )}
    </View>
  );
}
