import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Keyboard, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { z } from "zod";
import { useDatabase } from "@/lib/database";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldNumber } from "@/components/forms/form-fields";
import { updateMarketValue } from "@/shared/investments";

const schema = z.object({
  current_market_value: z.coerce.number().min(0, "Nilai pasar tidak boleh negatif"),
});

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export interface UpdateMarketValueSheetRef {
  present: () => void;
}

interface UpdateMarketValueSheetProps {
  accountId: string;
  currentValue: number;
  onUpdated: () => void;
}

export const UpdateMarketValueSheet = forwardRef<UpdateMarketValueSheetRef, UpdateMarketValueSheetProps>(
  function UpdateMarketValueSheet({ accountId, currentValue, onUpdated }, ref) {
    const db = useDatabase();
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheetModal>(null);
    const [isPending, setIsPending] = useState(false);
    // Key naik tiap dibuka supaya input yang tidak jadi disimpan tidak terbawa ke pembukaan berikutnya.
    const [formKey, setFormKey] = useState(0);
    const defaultValues = useMemo<FormValues>(() => ({ current_market_value: currentValue }), [currentValue]);

    useImperativeHandle(ref, () => ({
      present: () => {
        setFormKey((prev) => prev + 1);
        sheetRef.current?.present();
      },
    }));

    async function handleSubmit(values: FormOutput) {
      setIsPending(true);
      try {
        await updateMarketValue(db, accountId, values.current_market_value);
        onUpdated();
        sheetRef.current?.dismiss();
      } finally {
        setIsPending(false);
      }
    }

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={["45%", "70%"]}
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onChange={(index) => {
          if (index < 0) Keyboard.dismiss();
        }}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
      >
        <BottomSheetScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mb-1 text-lg font-semibold text-neutral-900">Update Nilai Pasar</Text>
          <Text className="mb-3 text-sm text-neutral-500">
            Hanya mengubah nilai pasar dan Unrealized P/L. Modal (saldo akun) tidak berubah.
          </Text>
          <BaseForm
            key={formKey}
            schema={schema}
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel="Simpan"
          >
            {(form) => (
              <FormFieldNumber
                form={form}
                name="current_market_value"
                label="Nilai Pasar Terkini"
                placeholder="0"
                prefix="Rp"
                grouped
                inBottomSheet
              />
            )}
          </BaseForm>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);
