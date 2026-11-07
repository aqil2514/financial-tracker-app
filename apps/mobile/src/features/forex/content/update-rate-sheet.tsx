import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Alert, Keyboard, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { SheetModal } from "@/components/sheet-modal";
import { useDatabase } from "@/lib/database";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldNumber, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { formatCurrencyPrecise } from "@/lib/utils";
import { updateForexRate } from "@/shared/forex";
import { deriveRate } from "../form/derive-rate";
import { forexRateFormSchema, type ForexRateFormOutput, type ForexRateFormValues } from "../form/schema";

export interface UpdateRateSheetRef {
  present: () => void;
}

interface Props {
  accountId: string;
  currency: string;
  remainingUnit: number;
  currentRate: number;
  onUpdated: () => void;
}

export const UpdateRateSheet = forwardRef<UpdateRateSheetRef, Props>(function UpdateRateSheet(
  { accountId, currency, remainingUnit, currentRate, onUpdated },
  ref
) {
  const db = useDatabase();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [isPending, setIsPending] = useState(false);
  // Key naik tiap dibuka supaya input yang tidak jadi disimpan tidak terbawa ke pembukaan berikutnya.
  const [formKey, setFormKey] = useState(0);
  const canUseTotal = remainingUnit > 0;
  const defaultValues = useMemo<ForexRateFormValues>(
    () => ({ rate_mode: canUseTotal ? "total" : "rate", rate_input: null as unknown as number }),
    [canUseTotal]
  );

  useImperativeHandle(ref, () => ({
    present: () => {
      setFormKey((prev) => prev + 1);
      sheetRef.current?.present();
    },
  }));

  async function handleSubmit(values: ForexRateFormOutput) {
    const rate = deriveRate(values.rate_mode, values.rate_input, remainingUnit);
    if (rate == null || !(rate > 0)) {
      Alert.alert("Tidak bisa disimpan", "Kurs tidak bisa dihitung dari nilai ini.");
      return;
    }
    setIsPending(true);
    try {
      await updateForexRate(db, accountId, rate);
      onUpdated();
      sheetRef.current?.dismiss();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <SheetModal
      ref={sheetRef}
      snapPoints={["55%", "75%"]}
      enableDynamicSizing={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(index) => {
        if (index < 0) Keyboard.dismiss();
      }}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />}
    >
      <BottomSheetScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="mb-1 text-lg font-semibold text-neutral-900">Update Kurs</Text>
        <Text className="mb-3 text-sm text-neutral-500">
          Hanya mengubah kurs, nilai terkini, dan Unrealized P/L. Modal (saldo akun) tidak berubah. Kurs saat ini{" "}
          {formatCurrencyPrecise(currentRate)} per {currency || "unit"}.
        </Text>
        <BaseForm
          key={formKey}
          schema={forexRateFormSchema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Simpan"
        >
          {(form) => <Fields form={form} currency={currency} remainingUnit={remainingUnit} canUseTotal={canUseTotal} />}
        </BaseForm>
      </BottomSheetScrollView>
    </SheetModal>
  );
});

function Fields({
  form,
  currency,
  remainingUnit,
  canUseTotal,
}: {
  form: UseFormReturn<ForexRateFormValues, unknown, ForexRateFormOutput>;
  currency: string;
  remainingUnit: number;
  canUseTotal: boolean;
}) {
  const [mode, rateInput] = useWatch({ control: form.control, name: ["rate_mode", "rate_input"] });
  const effectiveMode = canUseTotal ? mode : "rate";
  const inputNumber = Number(rateInput);
  const rate = inputNumber > 0 ? deriveRate(effectiveMode, inputNumber, remainingUnit) : null;

  return (
    <>
      {canUseTotal && (
        <FormFieldToggleGroup
          form={form}
          name="rate_mode"
          label="Isi berdasarkan"
          options={[
            { value: "total", label: "Nilai total" },
            { value: "rate", label: "Kurs" },
          ]}
        />
      )}
      <FormFieldNumber
        form={form}
        name="rate_input"
        label={effectiveMode === "total" ? "Nilai Terkini (Rp, versi bank)" : "Kurs Terkini (Rp per 1 unit)"}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
        inBottomSheet
      />
      <Text className="-mt-2 text-xs text-neutral-500">
        {effectiveMode === "total"
          ? `Salin "Nilai IDR" dari aplikasi bank untuk ${remainingUnit} ${currency}.${rate != null ? ` Setara ${formatCurrencyPrecise(rate)} per ${currency}.` : ""}`
          : canUseTotal
            ? "Isi dengan kurs beli bank, yaitu kurs yang akan Anda terima saat menukar kembali ke rupiah."
            : "Belum ada unit dipegang, jadi nilai total belum bisa dipakai. Isi kurs langsung."}
      </Text>
    </>
  );
}
