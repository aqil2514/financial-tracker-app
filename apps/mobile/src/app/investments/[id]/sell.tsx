import { useEffect, useState } from "react";
import { toLocalDateTime } from "@/lib/utils/local-datetime";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { computePricePerUnit } from "@/features/investments/form/derive-purchase";
import { SellForm } from "@/features/investments/form/sell-form";
import type { SellFormOutput, SellFormValues } from "@/features/investments/form/schema";
import {
  getAverageCostPerUnit,
  getRemainingUnit,
  InsufficientInvestmentUnitsError,
  recordInvestmentSale,
} from "@/shared/investments";

function emptySellValues(): SellFormValues {
  return {
    unit: null,
    price_mode: "unit",
    price_input: null,
    date: toLocalDateTime(),
    status: "pending",
    cash_account_id: null,
  };
}

type Holding = { name: string; unitLabel: string; remainingUnit: number; averageCost: number };

export default function SellInvestmentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptySellValues);
  const [cashAccountOptions, setCashAccountOptions] = useState<{ value: string; label: string }[]>([]);
  const [holding, setHolding] = useState<Holding | null>(null);

  useEffect(() => {
    db.getAllAsync<{ id: string; name: string }>(
      "SELECT id, name FROM accounts WHERE account_type = 'cash' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
    ).then((rows) => setCashAccountOptions(rows.map((row) => ({ value: row.id, label: row.name }))));

    async function loadHolding() {
      const account = await db.getFirstAsync<{ name: string; unit_label: string | null }>(
        `SELECT accounts.name, investment_accounts.unit_label
         FROM accounts
         LEFT JOIN investment_accounts ON investment_accounts.account_id = accounts.id
         WHERE accounts.id = ? AND accounts.account_type = 'investment'`,
        [id]
      );
      if (!account) return;
      const [remainingUnit, averageCost] = await Promise.all([
        getRemainingUnit(db, id),
        getAverageCostPerUnit(db, id),
      ]);
      setHolding({ name: account.name, unitLabel: account.unit_label ?? "", remainingUnit, averageCost });
    }
    loadHolding();
  }, [db, id]);

  async function handleSubmit(values: SellFormOutput) {
    setIsPending(true);
    try {
      await recordInvestmentSale({
        db,
        investmentAccountId: id,
        cashAccountId: values.status === "settled" ? values.cash_account_id : null,
        unit: values.unit as number,
        pricePerUnit: computePricePerUnit(values.price_mode, values.price_input, values.unit) as number,
        date: values.date,
        status: values.status,
      });
      router.back();
    } catch (error) {
      if (error instanceof InsufficientInvestmentUnitsError) {
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
      <Stack.Screen options={{ title: "Jual Investasi" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {holding ? (
          <>
            <Text className="text-sm text-neutral-500">Akun: {holding.name}</Text>
            <SellForm
              defaultValues={defaultValues}
              cashAccountOptions={cashAccountOptions}
              unitLabel={holding.unitLabel}
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
