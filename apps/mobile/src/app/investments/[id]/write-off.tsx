import { useEffect, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { WriteOffForm } from "@/features/investments/form/write-off-form";
import type { WriteOffFormOutput, WriteOffFormValues } from "@/features/investments/form/schema";
import {
  getAverageCostPerUnit,
  getRemainingUnit,
  InsufficientInvestmentUnitsError,
  recordInvestmentWriteOff,
} from "@/shared/investments";

const DEFAULT_NOTE = "Write-off investasi";

function emptyWriteOffValues(): WriteOffFormValues {
  return { unit: null, date: new Date().toISOString(), note: "" };
}

type Holding = { name: string; unitLabel: string; remainingUnit: number; averageCost: number };

export default function WriteOffInvestmentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyWriteOffValues);
  const [holding, setHolding] = useState<Holding | null>(null);

  useEffect(() => {
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

  async function handleSubmit(values: WriteOffFormOutput) {
    setIsPending(true);
    try {
      await recordInvestmentWriteOff({
        db,
        investmentAccountId: id,
        unit: values.unit as number,
        date: values.date,
        note: values.note.trim() || DEFAULT_NOTE,
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
      <Stack.Screen options={{ title: "Write-off Unit" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {holding ? (
          <>
            <Text className="text-sm text-neutral-500">Akun: {holding.name}</Text>
            <WriteOffForm
              defaultValues={defaultValues}
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
