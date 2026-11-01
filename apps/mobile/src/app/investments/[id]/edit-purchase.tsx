import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { EditPurchaseForm } from "@/features/investments/form/edit-purchase-form";
import { computePricePerUnit } from "@/features/investments/form/derive-purchase";
import type { EditPurchaseFormOutput, EditPurchaseFormValues } from "@/features/investments/form/schema";
import {
  getInvestmentPurchase,
  InvestmentPurchaseEditBlockedError,
  updateInvestmentPurchase,
  type InvestmentPurchaseDetail,
} from "@/shared/investments";

export default function EditInvestmentPurchasePage() {
  const { purchaseId } = useLocalSearchParams<{ id: string; purchaseId: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [purchase, setPurchase] = useState<InvestmentPurchaseDetail | null>(null);
  const [unitLabel, setUnitLabel] = useState("");
  const [defaultValues, setDefaultValues] = useState<EditPurchaseFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);
  const hasLoadedForm = useRef(false);

  // Dimuat ulang tiap layar fokus: pembelian bisa terhapus lewat "Buka transaksi terkait", dan layar ini
  // masih ada di tumpukan saat user kembali — tanpa ini tombol Simpan mengarah ke baris yang sudah hilang.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        const row = await getInvestmentPurchase(db, purchaseId);
        if (!active) return;
        if (!row) {
          router.back();
          return;
        }

        setPurchase(row);
        // Isian form hanya diisi sekali, supaya perubahan yang belum disimpan tidak ter-reset saat kembali fokus.
        if (hasLoadedForm.current) return;

        const account = await db.getFirstAsync<{ unit_label: string | null }>(
          "SELECT unit_label FROM investment_accounts WHERE account_id = ?",
          [row.accountId]
        );
        if (!active) return;
        hasLoadedForm.current = true;
        setUnitLabel(account?.unit_label ?? "");
        setDefaultValues({
          unit: row.unit,
          price_mode: "unit",
          price_input: row.pricePerUnit,
          status: row.status,
        });
      }

      load();
      return () => {
        active = false;
      };
    }, [db, purchaseId, router])
  );

  async function handleSubmit(values: EditPurchaseFormOutput) {
    setIsPending(true);
    try {
      await updateInvestmentPurchase({
        db,
        purchaseId,
        unit: values.unit,
        pricePerUnit: computePricePerUnit(values.price_mode, values.price_input, values.unit),
        status: values.status,
      });
      router.back();
    } catch (error) {
      if (error instanceof InvestmentPurchaseEditBlockedError) {
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
      <Stack.Screen options={{ title: "Edit Pembelian" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-4 p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues ? (
          <EditPurchaseForm
            defaultValues={defaultValues}
            unitLabel={unitLabel}
            onSubmit={handleSubmit}
            isPending={isPending}
          />
        ) : (
          <Text className="text-neutral-500">Memuat...</Text>
        )}

        {purchase?.transactionId && (
          <Pressable
            className="items-center rounded-md border border-neutral-300 px-4 py-3"
            onPress={() =>
              router.push({ pathname: "/transactions/[id]/edit", params: { id: purchase.transactionId as string } })
            }
          >
            <Text className="text-sm font-medium text-neutral-900">Buka transaksi terkait</Text>
            <Text className="mt-0.5 text-center text-xs text-neutral-500">
              Untuk mengubah nominal, tanggal, atau menghapus pembelian ini.
            </Text>
          </Pressable>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
