import { Text } from "react-native";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import {
  FormFieldDate,
  FormFieldNumber,
  FormFieldSelect,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { formatCurrencyPrecise } from "@/lib/utils";
import { purchaseFormSchema, type PurchaseFormOutput, type PurchaseFormValues } from "./schema";

const SOURCE_OPTIONS = [
  { value: "cash", label: "Dari akun kas" },
  { value: "direct", label: "Tanpa kas" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "settled", label: "Settled" },
];

const PRICE_MODE_OPTIONS = [
  { value: "unit", label: "Per unit" },
  { value: "total", label: "Total" },
];

type PurchaseFormProps = {
  defaultValues: PurchaseFormValues;
  cashAccountOptions: { value: string; label: string }[];
  unitLabel: string;
  onSubmit: (values: PurchaseFormOutput) => void;
  isPending: boolean;
};

export function PurchaseForm({ defaultValues, cashAccountOptions, unitLabel, onSubmit, isPending }: PurchaseFormProps) {
  return (
    <BaseForm
      schema={purchaseFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan"
    >
      {(form) => <PurchaseFormFields form={form} cashAccountOptions={cashAccountOptions} unitLabel={unitLabel} />}
    </BaseForm>
  );
}

function Hint({ children }: { children: string }) {
  return <Text className="-mt-2 text-xs text-neutral-500">{children}</Text>;
}

function PurchaseFormFields({
  form,
  cashAccountOptions,
  unitLabel,
}: {
  form: UseFormReturn<PurchaseFormValues, unknown, PurchaseFormOutput>;
  cashAccountOptions: { value: string; label: string }[];
  unitLabel: string;
}) {
  const [source, status, priceMode, unit, priceInput] = useWatch({
    control: form.control,
    name: ["source", "status", "price_mode", "unit", "price_input"],
  });
  const isDirect = source === "direct";
  const isFinal = isDirect || status === "settled";

  const unitNumber = Number(unit);
  const priceNumber = Number(priceInput);
  const perUnitPreview =
    priceMode === "total" && unitNumber > 0 && priceNumber > 0 ? priceNumber / unitNumber : null;

  return (
    <>
      <FormFieldToggleGroup form={form} name="source" label="Sumber" options={SOURCE_OPTIONS} />

      {isDirect ? (
        <>
          <FormFieldNumber
            form={form}
            name="amount"
            label="Modal yang diakui"
            placeholder="0"
            prefix="Rp"
            grouped
          />
          <Hint>
            Boleh 0 untuk hibah tanpa nilai. Dicatat sebagai pemasukan di akun investasi ini, jadi menambah modal. Juga
            dipakai untuk mencatat unit yang sudah dipegang sebelum memakai aplikasi.
          </Hint>
        </>
      ) : (
        <>
          <FormFieldSelect
            form={form}
            name="cash_account_id"
            label="Akun Kas"
            placeholder={cashAccountOptions.length === 0 ? "Belum ada akun kas aktif" : "Pilih akun kas"}
            options={cashAccountOptions}
          />
          <FormFieldNumber
            form={form}
            name="amount"
            label="Nominal"
            placeholder="0"
            prefix="Rp"
            grouped
            useCalculator
          />
          <Hint>Uang yang keluar dari akun kas saat ini.</Hint>
          <FormFieldToggleGroup form={form} name="status" label="Status" options={STATUS_OPTIONS} />
          <Hint>
            {isFinal
              ? "Nilainya sudah pasti — jumlah unit dan harga wajib diisi."
              : "Order masih diproses — unit dan harga boleh dikosongkan dulu."}
          </Hint>
        </>
      )}

      <FormFieldNumber
        form={form}
        name="unit"
        label={`Jumlah ${unitLabel || "Unit"}${isFinal ? "" : " (opsional)"}`}
        placeholder="0"
        decimal
      />

      <FormFieldToggleGroup form={form} name="price_mode" label="Input harga" options={PRICE_MODE_OPTIONS} />
      <FormFieldNumber
        form={form}
        name="price_input"
        label={`${priceMode === "total" ? "Harga total" : `Harga per ${unitLabel || "unit"}`}${isFinal ? "" : " (opsional)"}`}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
      />
      {perUnitPreview != null && <Hint>{`≈ ${formatCurrencyPrecise(perUnitPreview)} per ${unitLabel || "unit"}`}</Hint>}

      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Beli reksadana rutin" />
    </>
  );
}
