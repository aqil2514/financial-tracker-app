import { useState } from "react";
import { Text } from "react-native";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldDate, FormFieldNumber, FormFieldText } from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/utils";
import { formatUnit } from "../content/pl";
import { SellAllCheckbox } from "./sell-all-checkbox";
import { writeOffFormSchema, type WriteOffFormOutput, type WriteOffFormValues } from "./schema";

type WriteOffFormProps = {
  defaultValues: WriteOffFormValues;
  unitLabel: string;
  remainingUnit: number;
  averageCost: number;
  onSubmit: (values: WriteOffFormOutput) => void;
  isPending: boolean;
};

type FieldsProps = Pick<WriteOffFormProps, "unitLabel" | "remainingUnit" | "averageCost"> & {
  form: UseFormReturn<WriteOffFormValues, unknown, WriteOffFormOutput>;
};

export function WriteOffForm({ defaultValues, onSubmit, isPending, ...rest }: WriteOffFormProps) {
  return (
    <BaseForm
      schema={writeOffFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan Write-off"
    >
      {(form) => <WriteOffFormFields form={form} {...rest} />}
    </BaseForm>
  );
}

function WriteOffFormFields({ form, unitLabel, remainingUnit, averageCost }: FieldsProps) {
  const unit = useWatch({ control: form.control, name: "unit" });
  const [writeOffAll, setWriteOffAll] = useState(false);
  const unitName = unitLabel || "unit";

  function handleWriteOffAll(next: boolean) {
    setWriteOffAll(next);
    form.setValue("unit", next ? remainingUnit : null, { shouldValidate: true, shouldDirty: true });
  }

  const unitNumber = Number(unit);
  const loss = unitNumber > 0 ? averageCost * unitNumber : null;

  return (
    <>
      <Text className="text-sm text-neutral-500">
        Sisa yang bisa dihapus: {formatUnit(remainingUnit)} {unitName} · Average cost {formatCurrency(averageCost)}
      </Text>
      <Text className="-mt-2 text-xs text-neutral-500">
        Untuk unit yang hilang tanpa uang masuk (hibah keluar, delisting). Dicatat sebagai pengeluaran di akun
        investasi ini, tanpa menyentuh kas.
      </Text>

      <FormFieldNumber
        form={form}
        name="unit"
        label={`Jumlah ${unitName} hilang`}
        placeholder="0"
        decimal
        disabled={writeOffAll}
      />
      <SellAllCheckbox
        checked={writeOffAll}
        remainingUnit={remainingUnit}
        unitLabel={unitLabel}
        onChange={handleWriteOffAll}
      />
      {loss != null && (
        <Text className="-mt-2 text-xs text-neutral-500">
          {`Kerugian diakui ${formatCurrency(loss)} (average cost × unit), dihitung otomatis.`}
        </Text>
      )}

      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan (opsional)" placeholder="Mis. Delisting" />
    </>
  );
}
