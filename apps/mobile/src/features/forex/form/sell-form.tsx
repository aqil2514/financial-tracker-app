import { useState } from "react";
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
import { SellAllCheckbox } from "@/features/investments/form/sell-all-checkbox";
import { formatSignedCurrency, formatUnit } from "@/features/investments/content/pl";
import { formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { deriveRate } from "./derive-rate";
import { forexSellFormSchema, type ForexSellFormOutput, type ForexSellFormValues } from "./schema";

const RATE_MODE_OPTIONS = [
  { value: "rate", label: "Kurs" },
  { value: "total", label: "Nilai total" },
];

type Props = {
  defaultValues: ForexSellFormValues;
  cashAccountOptions: { value: string; label: string }[];
  currency: string;
  remainingUnit: number;
  averageCost: number;
  onSubmit: (values: ForexSellFormOutput) => void;
  isPending: boolean;
};

export function ForexSellForm({ defaultValues, onSubmit, isPending, ...rest }: Props) {
  return (
    <BaseForm
      schema={forexSellFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan Penjualan"
    >
      {(form) => <Fields form={form} {...rest} />}
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
  remainingUnit,
  averageCost,
}: Pick<Props, "cashAccountOptions" | "currency" | "remainingUnit" | "averageCost"> & {
  form: UseFormReturn<ForexSellFormValues, unknown, ForexSellFormOutput>;
}) {
  const [mode, unit, rateInput] = useWatch({ control: form.control, name: ["rate_mode", "unit", "rate_input"] });
  const [sellAll, setSellAll] = useState(false);
  const unitName = currency || "unit";

  function handleSellAll(next: boolean) {
    setSellAll(next);
    form.setValue("unit", next ? remainingUnit : null, { shouldValidate: true, shouldDirty: true });
  }

  const unitNumber = Number(unit);
  const inputNumber = Number(rateInput);
  const rate = unitNumber > 0 && inputNumber > 0 ? deriveRate(mode, inputNumber, unitNumber) : null;
  const proceeds = rate != null ? rate * unitNumber : null;
  const realizedPl = rate != null ? (rate - averageCost) * unitNumber : null;

  return (
    <>
      <Text className="text-sm text-neutral-500">
        Sisa yang bisa dijual: {formatUnit(remainingUnit)} {unitName} · Average cost {formatCurrencyPrecise(averageCost)}
      </Text>

      <FormFieldNumber
        form={form}
        name="unit"
        label={`Jumlah ${unitName} dijual`}
        placeholder="0"
        decimal
        disabled={sellAll}
      />
      <SellAllCheckbox checked={sellAll} remainingUnit={remainingUnit} unitLabel={currency} onChange={handleSellAll} />

      <FormFieldToggleGroup form={form} name="rate_mode" label="Isi berdasarkan" options={RATE_MODE_OPTIONS} />
      <FormFieldNumber
        form={form}
        name="rate_input"
        label={mode === "total" ? "Nilai total yang diterima" : `Kurs jual per ${unitName}`}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
      />
      {mode === "total" && rate != null && <Hint>{`≈ ${formatCurrencyPrecise(rate)} per ${unitName}`}</Hint>}

      <FormFieldSelect
        form={form}
        name="cash_account_id"
        label="Akun Kas Tujuan"
        placeholder={cashAccountOptions.length === 0 ? "Belum ada akun kas aktif" : "Pilih akun kas"}
        options={cashAccountOptions}
      />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan" placeholder={`Mis. Jual ${unitName}`} />

      {proceeds != null && realizedPl != null && (
        <Text className="text-xs text-neutral-500">
          Kas menerima {formatCurrency(proceeds)} · Realized P/L {formatSignedCurrency(realizedPl)} (berdasarkan
          average cost saat ini)
        </Text>
      )}
    </>
  );
}
