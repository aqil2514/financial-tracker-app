import { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldSelect } from "@/components/forms/form-fields";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { formatSignedCurrency, formatUnit } from "@/features/investments/content/pl";
import {
  settleSaleFormSchema,
  type SettleSaleFormOutput,
  type SettleSaleFormValues,
} from "@/features/investments/form/schema";
import { getAverageCostPerUnit, settleInvestmentSale } from "@/shared/investments";

type PendingSale = { unit: number; pricePerUnit: number; unitLabel: string; averageCost: number };

const DEFAULT_VALUES: SettleSaleFormValues = { cash_account_id: "" };

export default function SettleInvestmentSalePage() {
  const { id, saleId } = useLocalSearchParams<{ id: string; saleId: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [sale, setSale] = useState<PendingSale | null>(null);
  const [cashAccountOptions, setCashAccountOptions] = useState<{ value: string; label: string }[]>([]);

  // Dimuat ulang tiap fokus; menutup diri kalau barisnya sudah hilang atau sudah settled.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        const row = await db.getFirstAsync<{ unit: number; price_per_unit: number; status: string }>(
          "SELECT unit, price_per_unit, status FROM investment_sales WHERE id = ?",
          [saleId]
        );
        if (!active) return;
        if (!row || row.status !== "pending") {
          router.back();
          return;
        }

        const [account, averageCost, cashRows] = await Promise.all([
          db.getFirstAsync<{ unit_label: string | null }>(
            "SELECT unit_label FROM investment_accounts WHERE account_id = ?",
            [id]
          ),
          getAverageCostPerUnit(db, id),
          db.getAllAsync<{ id: string; name: string }>(
            "SELECT id, name FROM accounts WHERE account_type = 'cash' AND is_active = 1 ORDER BY name COLLATE NOCASE ASC"
          ),
        ]);
        if (!active) return;
        setSale({
          unit: row.unit,
          pricePerUnit: row.price_per_unit,
          unitLabel: account?.unit_label ?? "",
          averageCost,
        });
        setCashAccountOptions(cashRows.map((cash) => ({ value: cash.id, label: cash.name })));
      }

      load();
      return () => {
        active = false;
      };
    }, [db, id, saleId, router])
  );

  async function handleSubmit(values: SettleSaleFormOutput) {
    setIsPending(true);
    try {
      await settleInvestmentSale(db, saleId, values.cash_account_id);
      router.back();
    } catch (error) {
      Alert.alert("Gagal settle", error instanceof Error ? error.message : "Terjadi kesalahan.");
    } finally {
      setIsPending(false);
    }
  }

  const proceeds = sale ? sale.unit * sale.pricePerUnit : 0;
  const realizedPl = sale ? (sale.pricePerUnit - sale.averageCost) * sale.unit : 0;

  return (
    <>
      <Stack.Screen options={{ title: "Settle Penjualan" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {sale ? (
          <>
            <Text className="text-sm text-neutral-900">
              {formatUnit(sale.unit)} {sale.unitLabel || "unit"} × {formatCurrency(sale.pricePerUnit)} ={" "}
              {formatCurrency(proceeds)}
            </Text>
            <Text className="text-xs text-neutral-500">
              Dengan average cost saat ini ({formatCurrency(sale.averageCost)}), Realized P/L ={" "}
              {formatSignedCurrency(realizedPl)}. Angka final dikunci saat disimpan.
            </Text>
            <BaseForm
              schema={settleSaleFormSchema}
              defaultValues={DEFAULT_VALUES}
              onSubmit={handleSubmit}
              isPending={isPending}
              submitLabel="Settle"
            >
              {(form) => (
                <FormFieldSelect
                  form={form}
                  name="cash_account_id"
                  label="Akun Kas Tujuan"
                  placeholder={cashAccountOptions.length === 0 ? "Belum ada akun kas aktif" : "Pilih akun kas"}
                  options={cashAccountOptions}
                />
              )}
            </BaseForm>
          </>
        ) : (
          <Text className="text-neutral-500">Memuat...</Text>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
