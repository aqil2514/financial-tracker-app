import { Text } from "react-native";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import {
  FormFieldDate,
  FormFieldNumber,
  FormFieldSelect,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { formatCurrency } from "@/lib/utils";
import { formatSignedCurrency, formatUnit } from "../content/pl";
import { computePricePerUnit } from "./derive-purchase";
import { sellFormSchema, type SellFormOutput, type SellFormValues } from "./schema";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "settled", label: "Settled" },
];

const PRICE_MODE_OPTIONS = [
  { value: "unit", label: "Per unit" },
  { value: "total", label: "Total" },
];

type SellFormProps = {
  defaultValues: SellFormValues;
  cashAccountOptions: { value: string; label: string }[];
  unitLabel: string;
  remainingUnit: number;
  averageCost: number;
  onSubmit: (values: SellFormOutput) => void;
  isPending: boolean;
};

type FieldsProps = Pick<SellFormProps, "cashAccountOptions" | "unitLabel" | "remainingUnit" | "averageCost"> & {
  form: UseFormReturn<SellFormValues, unknown, SellFormOutput>;
};

export function SellForm({ defaultValues, onSubmit, isPending, ...rest }: SellFormProps) {
  return (
    <BaseForm
      schema={sellFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan Penjualan"
    >
      {(form) => <SellFormFields form={form} {...rest} />}
    </BaseForm>
  );
}

function Hint({ children }: { children: string }) {
  return <Text className="-mt-2 text-xs text-neutral-500">{children}</Text>;
}

function SellFormFields({ form, cashAccountOptions, unitLabel, remainingUnit, averageCost }: FieldsProps) {
  const [status, priceMode, unit, priceInput] = useWatch({
    control: form.control,
    name: ["status", "price_mode", "unit", "price_input"],
  });
  const isSettled = status === "settled";
  const unitName = unitLabel || "unit";

  const unitNumber = Number(unit);
  const priceNumber = Number(priceInput);
  const pricePerUnit =
    unitNumber > 0 && priceNumber > 0 ? computePricePerUnit(priceMode, priceNumber, unitNumber) : null;
  const perUnitPreview = priceMode === "total" ? pricePerUnit : null;
  const proceeds = pricePerUnit != null ? pricePerUnit * unitNumber : null;
  const realizedPl = pricePerUnit != null ? (pricePerUnit - averageCost) * unitNumber : null;

  return (
    <>
      <Text className="text-sm text-neutral-500">
        Sisa yang bisa dijual: {formatUnit(remainingUnit)} {unitName} · Average cost {formatCurrency(averageCost)}
      </Text>

      <FormFieldToggleGroup form={form} name="status" label="Status" options={STATUS_OPTIONS} />
      <Hint>
        {isSettled
          ? "Dana sudah cair: kas bertambah sekarang dan Realized P/L dikunci."
          : "Order jual masih diproses: unit langsung berkurang, tapi kas belum tersentuh sampai Anda menekan Settle."}
      </Hint>

      <FormFieldNumber form={form} name="unit" label={`Jumlah ${unitName} dijual`} placeholder="0" decimal />

      <FormFieldToggleGroup form={form} name="price_mode" label="Input harga jual" options={PRICE_MODE_OPTIONS} />
      <FormFieldNumber
        form={form}
        name="price_input"
        label={priceMode === "total" ? "Harga jual total" : `Harga jual per ${unitName}`}
        placeholder="0"
        prefix="Rp"
        grouped
        decimal
      />
      {perUnitPreview != null && <Hint>{`≈ ${formatCurrency(perUnitPreview)} per ${unitName}`}</Hint>}

      {isSettled && (
        <FormFieldSelect
          form={form}
          name="cash_account_id"
          label="Akun Kas Tujuan"
          placeholder={cashAccountOptions.length === 0 ? "Belum ada akun kas aktif" : "Pilih akun kas"}
          options={cashAccountOptions}
        />
      )}

      <FormFieldDate form={form} name="date" label="Tanggal" />

      {proceeds != null && realizedPl != null && (
        <Text className="text-xs text-neutral-500">
          {isSettled
            ? `Kas menerima ${formatCurrency(proceeds)} · Realized P/L ${formatSignedCurrency(realizedPl)} (berdasarkan average cost saat ini)`
            : `Estimasi hasil ${formatCurrency(proceeds)} · P/L baru dihitung saat Settle`}
        </Text>
      )}
    </>
  );
}
