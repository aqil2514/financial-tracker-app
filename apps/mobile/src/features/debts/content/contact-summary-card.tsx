import { Pressable, Text, View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { ContactDebtSummary } from "@/shared/debts";

export function ContactSummaryCard({
  contact,
  onPress,
}: {
  contact: ContactDebtSummary;
  onPress: () => void;
}) {
  const hasReceivable = contact.receivable_active > 0;
  const hasPayable = contact.payable_active > 0;

  return (
    <Pressable
      className="gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-semibold text-neutral-900" numberOfLines={1}>
          {contact.contact_name}
        </Text>
        <View className="flex-row gap-1">
          {hasReceivable && (
            <View className="rounded-full bg-green-100 px-2 py-0.5">
              <Text className="text-xs font-medium text-green-700">Piutang</Text>
            </View>
          )}
          {hasPayable && (
            <View className="rounded-full bg-red-100 px-2 py-0.5">
              <Text className="text-xs font-medium text-red-700">Utang</Text>
            </View>
          )}
        </View>
      </View>

      {hasReceivable && (
        <DebtDirectionBlock
          label="Piutang"
          active={contact.receivable_active}
          paid={contact.receivable_paid}
          remaining={contact.receivable_remaining}
          tone="receivable"
        />
      )}

      {hasReceivable && hasPayable && <View className="border-t border-neutral-100" />}

      {hasPayable && (
        <DebtDirectionBlock
          label="Utang"
          active={contact.payable_active}
          paid={contact.payable_paid}
          remaining={contact.payable_remaining}
          tone="payable"
        />
      )}
    </Pressable>
  );
}

function DebtDirectionBlock({
  label,
  active,
  paid,
  remaining,
  tone,
}: {
  label: string;
  active: number;
  paid: number;
  remaining: number;
  tone: "receivable" | "payable";
}) {
  const toneClass = tone === "receivable" ? "text-green-700" : "text-red-700";

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between">
        <View>
          <Text className="text-xs text-neutral-500">{label} Aktif</Text>
          <Text className={`font-medium ${toneClass}`}>{formatCurrency(active)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-xs text-neutral-500">Terbayar</Text>
          <Text className="font-medium text-neutral-900">{formatCurrency(paid)}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between border-t border-neutral-100 pt-1.5">
        <Text className="text-xs text-neutral-500">Belum Dibayar</Text>
        <Text className={`text-base font-semibold ${toneClass}`}>{formatCurrency(remaining)}</Text>
      </View>
    </View>
  );
}
