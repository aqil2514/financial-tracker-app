import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { toLocalDateTime } from "@/lib/utils/local-datetime";
import { deriveRate } from "@/features/forex/form/derive-rate";
import { ForexPurchaseForm } from "@/features/forex/form/purchase-form";
import type { ForexPurchaseFormOutput, ForexPurchaseFormValues } from "@/features/forex/form/schema";
import { recordForexPurchase } from "@/shared/forex";

function emptyPurchaseValues(currency: string): ForexPurchaseFormValues {
  return {
    source: "cash",
    cash_account_id: null,
    unit: null as unknown as number,
    rate_mode: "rate",
    rate_input: null as unknown as number,
    date: toLocalDateTime(),
    note: currency ? `Beli ${currency}` : "",
  };
}

export default function NewForexPurchasePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [cashAccountOptions, setCashAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [account, setAccount] = useState<{ name: string; currency: string } | null>(null);

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'cash' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setCashAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));

    db.getFirstAsync<{ name: string; currency: string | null }>(
      `SELECT accounts.name, forex_accounts.currency
       FROM accounts
       LEFT JOIN forex_accounts ON forex_accounts.account_id = accounts.id
       WHERE accounts.id = ? AND accounts.account_type = 'forex'`,
      [id]
    ).then((row) => setAccount(row ? { name: row.name, currency: row.currency ?? "" } : null));
  }, [db, id]);

  async function handleSubmit(values: ForexPurchaseFormOutput) {
    const rate = deriveRate(values.rate_mode, values.rate_input, values.unit);
    if (rate == null) {
      Alert.alert("Tidak bisa disimpan", "Kurs tidak bisa dihitung dari nilai ini.");
      return;
    }

    setIsPending(true);
    try {
      await recordForexPurchase({
        db,
        forexAccountId: id,
        cashAccountId: values.source === "cash" ? values.cash_account_id : null,
        unit: values.unit,
        rate,
        date: values.date,
        note: values.note,
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
      <Stack.Screen options={{ title: "Beli Valas" }} />
      <KeyboardAwareScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-4 pb-12" bottomOffset={20}>
        {account ? (
          <>
            <Text className="text-sm text-neutral-500">Akun: {account.name}</Text>
            <ForexPurchaseForm
              defaultValues={emptyPurchaseValues(account.currency)}
              cashAccountOptions={cashAccountOptions}
              currency={account.currency}
              onSubmit={handleSubmit}
              isPending={isPending}
            />
          </>
        ) : (
          <Text className="text-neutral-500">Memuat...</Text>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
