import { useEffect, useState } from "react";
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
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { FormFieldContact } from "@/features/transactions/form/fields/form-field-contact";
import { getRemainingThirdPartyFund } from "@/shared/third-party-funds";
import { recordFundFormSchema, type RecordFundFormOutput, type RecordFundFormValues } from "./schema";

const DIRECTION_OPTIONS = [
  { value: "in", label: "Titip" },
  { value: "out", label: "Ambil" },
];

type RecordFundFormProps = {
  defaultValues: RecordFundFormValues;
  accountOptions: { value: string; label: string }[];
  onSubmit: (values: RecordFundFormOutput) => void;
  isPending: boolean;
};

export function RecordFundForm({ defaultValues, accountOptions, onSubmit, isPending }: RecordFundFormProps) {
  return (
    <BaseForm
      schema={recordFundFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan"
    >
      {(form) => <RecordFundFormFields form={form} accountOptions={accountOptions} />}
    </BaseForm>
  );
}

function RecordFundFormFields({
  form,
  accountOptions,
}: {
  form: UseFormReturn<RecordFundFormValues, unknown, RecordFundFormOutput>;
  accountOptions: { value: string; label: string }[];
}) {
  const db = useDatabase();
  const [direction, accountId, contactId] = useWatch({
    control: form.control,
    name: ["direction", "account_id", "contact_id"],
  });
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!accountId || !contactId) {
      setRemaining(null);
      return;
    }
    let cancelled = false;
    getRemainingThirdPartyFund(db, accountId, contactId).then((value) => {
      if (!cancelled) setRemaining(value);
    });
    return () => {
      cancelled = true;
    };
  }, [db, accountId, contactId]);

  return (
    <>
      <FormFieldToggleGroup form={form} name="direction" label="Jenis" options={DIRECTION_OPTIONS} />
      <Text className="-mt-2 text-xs text-neutral-500">
        {direction === "in"
          ? "Ada yang menitipkan uang ke Anda. Dicatat sebagai pemasukan di akun dana pihak ketiga, kas pribadi tidak berubah."
          : "Titipan diambil kembali oleh pemiliknya. Tidak boleh melebihi sisa titipan kontak itu di akun ini."}
      </Text>

      <FormFieldSelect
        form={form}
        name="account_id"
        label="Akun (tempat titipan)"
        placeholder={accountOptions.length === 0 ? "Belum ada akun dana pihak ketiga aktif" : "Pilih akun"}
        options={accountOptions}
      />
      <FormFieldContact control={form.control} />
      {remaining != null && (
        <Text className="-mt-2 text-xs text-neutral-500">
          {`Sisa titipan kontak ini di akun ini: ${formatCurrency(remaining)}`}
        </Text>
      )}

      <FormFieldNumber form={form} name="amount" label="Nominal" placeholder="0" prefix="Rp" grouped useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan (opsional)" placeholder="Mis. Tabungan" />
    </>
  );
}
