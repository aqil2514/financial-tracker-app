import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { PurchaseForm } from "@/features/investments/form/purchase-form";
import { derivePurchase } from "@/features/investments/form/derive-purchase";
import { emptyPurchaseValues } from "@/features/investments/form/values";
import type { PurchaseFormOutput } from "@/features/investments/form/schema";
import { recordInvestmentPurchase } from "@/shared/investments";

export default function NewInvestmentPurchasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyPurchaseValues);
  const [cashAccountOptions, setCashAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [account, setAccount] = useState<{ name: string; unitLabel: string } | null>(null);

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'cash' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setCashAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));

    db.getFirstAsync<{ name: string; unit_label: string | null }>(
      `SELECT accounts.name, investment_accounts.unit_label
       FROM accounts
       LEFT JOIN investment_accounts ON investment_accounts.account_id = accounts.id
       WHERE accounts.id = ? AND accounts.account_type = 'investment'`,
      [id]
    ).then((row) => setAccount(row ? { name: row.name, unitLabel: row.unit_label ?? "" } : null));
  }, [db, id]);

  async function handleSubmit(values: PurchaseFormOutput) {
    const { status, cashAccountId, unit, pricePerUnit } = derivePurchase(values);

    setIsPending(true);
    try {
      await recordInvestmentPurchase({
        db,
        investmentAccountId: id,
        cashAccountId,
        amount: values.amount,
        unit,
        pricePerUnit,
        date: values.date,
        note: values.note,
        status,
      });
      router.back();
    } catch (error) {
      Alert.alert("Gagal menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Catat Pembelian" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {account && <Text className="text-sm text-neutral-500">Akun: {account.name}</Text>}
        <PurchaseForm
          defaultValues={defaultValues}
          cashAccountOptions={cashAccountOptions}
          unitLabel={account?.unitLabel ?? ""}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      </KeyboardAwareScrollView>
    </>
  );
}
