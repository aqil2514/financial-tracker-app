import { Controller, type Control } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/lib/utils";
import type { TransactionFormValues } from "../schema";
import type { OngoingDebt } from "../use-transaction-debt-fields";

interface FieldDebtActionProps {
  control: Control<TransactionFormValues>;
  ongoingDebts: OngoingDebt[];
  direction: "receivable" | "payable";
}

function formatDebtDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function FieldDebtAction({ control, ongoingDebts, direction }: FieldDebtActionProps) {
  const label = direction === "receivable" ? "Piutang yang dilunasi" : "Utang yang dibayar";

  return (
    <Controller
      control={control}
      name="settle_debt_ids"
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">{label}</Text>

          {ongoingDebts.length === 0 ? (
            <Text className="text-sm text-neutral-500">
              Belum ada {direction === "receivable" ? "piutang" : "utang"} ongoing untuk kontak ini.
            </Text>
          ) : (
            <View className="gap-1">
              {ongoingDebts.map((debt) => {
                const isChecked = field.value.includes(debt.id);
                return (
                  <Pressable
                    key={debt.id}
                    className="flex-row items-center justify-between rounded-md border border-neutral-200 px-3 py-2.5"
                    onPress={() => {
                      field.onChange(
                        isChecked
                          ? field.value.filter((id) => id !== debt.id)
                          : [...field.value, debt.id]
                      );
                    }}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons
                        name={isChecked ? "checkbox" : "square-outline"}
                        size={20}
                        color={isChecked ? "#171717" : "#a3a3a3"}
                      />
                      <Text className="text-neutral-900">{formatDebtDate(debt.date)}</Text>
                    </View>
                    <Text className="font-medium text-neutral-900">
                      {formatCurrency(debt.remaining)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {fieldState.error && <Text className="text-sm text-red-600">{fieldState.error.message}</Text>}
        </View>
      )}
    />
  );
}
