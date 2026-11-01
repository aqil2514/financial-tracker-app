import { Text } from "react-native";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldNumber, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/utils";
import { editPurchaseFormSchema, type EditPurchaseFormOutput, type EditPurchaseFormValues } from "./schema";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "settled", label: "Settled" },
];

const PRICE_MODE_OPTIONS = [
  { value: "unit", label: "Per unit" },
  { value: "total", label: "Total" },
];

type EditPurchaseFormProps = {
  defaultValues: EditPurchaseFormValues;
  unitLabel: string;
  onSubmit: (values: EditPurchaseFormOutput) => void;
  isPending: boolean;
};

export function EditPurchaseForm({ defaultValues, unitLabel, onSubmit, isPending }: EditPurchaseFormProps) {
  return (
    <BaseForm
      schema={editPurchaseFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan Perubahan"
    >
      {(form) => <EditPurchaseFormFields form={form} unitLabel={unitLabel} />}
    </BaseForm>
  );
}

function EditPurchaseFormFields({
  form,
  unitLabel,
}: {
  form: UseFormReturn<EditPurchaseFormValues, unknown, EditPurchaseFormOutput>;
  unitLabel: string;
}) {
  const [status, priceMode, unit, priceInput] = useWatch({
    control: form.control,
    name: ["status", "price_mode", "unit", "price_input"],
  });
  const isFinal = status === "settled";
  const optionalSuffix = isFinal ? "" : " (opsional)";
  const unitName = unitLabel || "unit";

  const unitNumber = Number(unit);
  const priceNumber = Number(priceInput);
  const perUnitPreview = priceMode === "total" && unitNumber > 0 && priceNumber > 0 ? priceNumber / unitNumber : null;

  return (
    <>
      <FormFieldToggleGroup form={form} name="status" label="Status" options={STATUS_OPTIONS} />
      <Text className="-mt-2 text-xs text-neutral-500">
        {isFinal
          ? "Nilainya sudah pasti — jumlah unit dan harga wajib diisi."
          : "Order masih diproses — unit dan harga boleh dikosongkan dulu."}
      </Text>

      <FormFieldNumber
        form={form}
        name="unit"
        label={`Jumlah ${unitName}${optionalSuffix}`}
        placeholder="0"
        decimal
      />

      <FormFieldToggleGroup form={form} name="price_mode" label="Input harga" options={PRICE_MODE_OPTIONS} />
      <FormFieldNumber
        form={form}
        name="price_input"
        label={`${priceMode === "total" ? "Harga total" : `Harga per ${unitName}`}${optionalSuffix}`}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
      />
      {perUnitPreview != null && (
        <Text className="-mt-2 text-xs text-neutral-500">{`≈ ${formatCurrency(perUnitPreview)} per ${unitName}`}</Text>
      )}
    </>
  );
}
