import { Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import { useDatabase } from "@/lib/database";
import { DebtList } from "@/features/debts/content/debt-list";
import { useDebtsList } from "@/features/debts/content/use-debts-list";
import { writeOffDebt, type DebtListRow } from "@/shared/debts";

export default function DebtsListPage() {
  const router = useRouter();
  const db = useDatabase();
  const { debts, isLoading, refetch } = useDebtsList();

  function handlePay(debt: DebtListRow) {
    if (!debt.account_id) {
      Alert.alert("Tidak bisa dibayar", "Piutang/utang ini tidak terhubung ke akun manapun.");
      return;
    }
    router.push({
      pathname: "/transactions/new",
      params: {
        payDebtId: debt.id,
        payDebtType: debt.type,
        payDebtAccountId: debt.account_id,
        payDebtContactId: debt.contact_id ?? "",
      },
    });
  }

  async function handleWriteOff(debt: DebtListRow) {
    if (!debt.account_id) {
      Alert.alert("Tidak bisa dihapuskan", "Piutang/utang ini tidak terhubung ke akun manapun.");
      return;
    }
    await writeOffDebt({
      db,
      debtId: debt.id,
      type: debt.type,
      accountId: debt.account_id,
      remaining: debt.remaining,
    });
    await refetch();
  }

  return (
    <>
      <Stack.Screen options={{ title: "Utang Piutang" }} />
      <View className="flex-1 bg-white">
        <DebtList debts={debts} isLoading={isLoading} onPay={handlePay} onWriteOff={handleWriteOff} />
      </View>
    </>
  );
}
