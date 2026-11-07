import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { toLocalDateTime } from "@/lib/utils/local-datetime";
import { deriveRate } from "@/features/forex/form/derive-rate";
import { ForexSellForm } from "@/features/forex/form/sell-form";
import type { ForexSellFormOutput, ForexSellFormValues } from "@/features/forex/form/schema";
import { getForexAverageCostPerUnit, getForexRemainingUnit, InsufficientForexUnitsError, sellForex } from "@/shared/forex";

function emptySellValues(currency: string): ForexSellFormValues {
  return {
    cash_account_id: "",
    unit: null as unknown as number,
    rate_mode: "rate",
    rate_input: null as unknown as number,
    date: toLocalDateTime(),
    note: currency ? `Jual ${currency}` : "",
  };
}

type Holding = { name: string; currency: string; remainingUnit: number; averageCost: number };

export default function SellForexPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [cashAccountOptions, setCashAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [holding, setHolding] = useState<Holding | null>(null);

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'cash' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setCashAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));

    async function loadHolding() {
      const account = await db.getFirstAsync<{ name: string; currency: string | null }>(
        `SELECT accounts.name, forex_accounts.currency
         FROM accounts
         LEFT JOIN forex_accounts ON forex_accounts.account_id = accounts.id
         WHERE accounts.id = ? AND accounts.account_type = 'forex'`,
        [id]
      );
      if (!account) return;
      const [remainingUnit, averageCost] = await Promise.all([
        getForexRemainingUnit(db, id),
        getForexAverageCostPerUnit(db, id),
      ]);
      setHolding({ name: account.name, currency: account.currency ?? "", remainingUnit, averageCost });
    }
    loadHolding();
  }, [db, id]);

  async function handleSubmit(values: ForexSellFormOutput) {
    const rate = deriveRate(values.rate_mode, values.rate_input, values.unit);
    if (rate == null) {
      Alert.alert("Tidak bisa disimpan", "Kurs tidak bisa dihitung dari nilai ini.");
      return;
    }

    setIsPending(true);
    try {
      await sellForex({
        db,
        forexAccountId: id,
        cashAccountId: values.cash_account_id,
        unit: values.unit,
        rate,
        date: values.date,
        note: values.note,
      });
      router.back();
    } catch (error) {
      if (error instanceof InsufficientForexUnitsError) {
        Alert.alert("Tidak bisa disimpan", error.message);
      } else {
        Alert.alert("Gagal menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan.");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Jual Valas" }} />
      <KeyboardAwareScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-4 pb-12" bottomOffset={20}>
        {holding ? (
          <>
            <Text className="text-sm text-neutral-500">Akun: {holding.name}</Text>
            <ForexSellForm
              defaultValues={emptySellValues(holding.currency)}
              cashAccountOptions={cashAccountOptions}
              currency={holding.currency}
              remainingUnit={holding.remainingUnit}
              averageCost={holding.averageCost}
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
