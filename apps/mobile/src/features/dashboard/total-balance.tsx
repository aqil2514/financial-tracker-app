import { Text, View } from "react-native";
import { Skeleton } from "@/components/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useBalancesByAccountType } from "@/features/reports/account-type/use-balances-by-account-type";

// Hanya akun bertipe Kas: dana pihak ketiga bukan milik sendiri, utang dan investasi punya konsep saldo sendiri.
export function TotalBalance() {
  const { data, isLoading } = useBalancesByAccountType();
  const total = data.find((row) => row.account_type === "cash")?.total ?? 0;

  return (
    <View className="gap-1 rounded-lg border border-neutral-200 p-4">
      <Text className="text-sm text-neutral-500">Total Saldo</Text>
      {isLoading ? (
        <Skeleton className="h-8 w-48" />
      ) : (
        <Text
          className={`text-3xl font-semibold ${total < 0 ? "text-red-600" : "text-neutral-900"}`}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatCurrency(total)}
        </Text>
      )}
      <Text className="text-xs text-neutral-400">Akun kas aktif</Text>
    </View>
  );
}
