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
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { deriveRate } from "./derive-rate";
import { forexPurchaseFormSchema, type ForexPurchaseFormOutput, type ForexPurchaseFormValues } from "./schema";

const SOURCE_OPTIONS = [
  { value: "cash", label: "Dari akun kas" },
  { value: "direct", label: "Tanpa kas" },
];

const RATE_MODE_OPTIONS = [
  { value: "rate", label: "Kurs" },
  { value: "total", label: "Nilai total" },
];

type Props = {
  defaultValues: ForexPurchaseFormValues;
  cashAccountOptions: { value: string; label: string }[];
  currency: string;
  onSubmit: (values: ForexPurchaseFormOutput) => void;
  isPending: boolean;
};

export function ForexPurchaseForm({ defaultValues, cashAccountOptions, currency, onSubmit, isPending }: Props) {
  return (
    <BaseForm
      schema={forexPurchaseFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan"
    >
      {(form) => <Fields form={form} cashAccountOptions={cashAccountOptions} currency={currency} />}
    </BaseForm>
  );
}

function Hint({ children }: { children: string }) {
  return <Text className="-mt-2 text-xs text-neutral-500">{children}</Text>;
}

function Fields({
  form,
  cashAccountOptions,
  currency,
}: {
  form: UseFormReturn<ForexPurchaseFormValues, unknown, ForexPurchaseFormOutput>;
  cashAccountOptions: { value: string; label: string }[];
  currency: string;
}) {
  const [source, mode, unit, rateInput] = useWatch({
    control: form.control,
    name: ["source", "rate_mode", "unit", "rate_input"],
  });
  const isDirect = source === "direct";
  const unitName = currency || "unit";

  const unitNumber = Number(unit);
  const inputNumber = Number(rateInput);
  const rate = unitNumber > 0 && inputNumber > 0 ? deriveRate(mode, inputNumber, unitNumber) : null;

  return (
    <>
      <FormFieldToggleGroup form={form} name="source" label="Sumber" options={SOURCE_OPTIONS} />
      {isDirect ? (
        <Hint>
          Untuk valas yang sudah dipegang tanpa kas sumber yang dilacak. Dicatat sebagai pemasukan di akun valas ini
          senilai unit × kurs, jadi menambah modal.
        </Hint>
      ) : (
        <FormFieldSelect
          form={form}
          name="cash_account_id"
          label="Akun Kas"
          placeholder={cashAccountOptions.length === 0 ? "Belum ada akun kas aktif" : "Pilih akun kas"}
          options={cashAccountOptions}
        />
      )}

      <FormFieldNumber form={form} name="unit" label={`Jumlah ${unitName}`} placeholder="0" decimal />

      <FormFieldToggleGroup form={form} name="rate_mode" label="Isi berdasarkan" options={RATE_MODE_OPTIONS} />
      <FormFieldNumber
        form={form}
        name="rate_input"
        label={mode === "total" ? "Nilai total yang dibayar" : `Kurs beli per ${unitName}`}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
      />
      {mode === "total" && rate != null && <Hint>{`≈ ${formatCurrencyPrecise(rate)} per ${unitName}`}</Hint>}
      {rate != null && (
        <Text className="text-xs text-neutral-500">
          {isDirect ? "Modal bertambah" : "Kas keluar"} {formatCurrency(unitNumber * rate)}
        </Text>
      )}

      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan" placeholder={`Mis. Beli ${unitName}`} />
    </>
  );
}
