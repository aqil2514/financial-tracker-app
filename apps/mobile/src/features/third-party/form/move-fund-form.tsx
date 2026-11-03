import { useEffect, useState } from "react";
import { Text } from "react-native";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldDate, FormFieldNumber, FormFieldSelect, FormFieldText } from "@/components/forms/form-fields";
import { useDatabase } from "@/lib/database";
import { formatCurrency } from "@/lib/utils";
import { FormFieldContact } from "@/features/transactions/form/fields/form-field-contact";
import { getRemainingThirdPartyFund } from "@/shared/third-party-funds";
import { moveFundFormSchema, type MoveFundFormOutput, type MoveFundFormValues } from "./schema";

const KIND_OPTIONS = [
  { value: "move_location", label: "Pindah Tempat" },
  { value: "move_ownership", label: "Pindah Kepemilikan" },
  { value: "both", label: "Keduanya" },
];

const KIND_HINT = {
  move_location: "Titipan orang yang sama dipindah dari satu akun (tempat) ke akun lain.",
  move_ownership: "Titipan di akun yang sama dialihkan dari satu kontak ke kontak lain.",
  both: "Titipan dipindah ke akun lain sekaligus dialihkan ke kontak lain.",
} as const;

type MoveFundFormProps = {
  defaultValues: MoveFundFormValues;
  accountOptions: { value: string; label: string }[];
  onSubmit: (values: MoveFundFormOutput) => void;
  isPending: boolean;
};

export function MoveFundForm({ defaultValues, accountOptions, onSubmit, isPending }: MoveFundFormProps) {
  return (
    <BaseForm
      schema={moveFundFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel="Simpan"
    >
      {(form) => <MoveFundFormFields form={form} accountOptions={accountOptions} />}
    </BaseForm>
  );
}

function MoveFundFormFields({
  form,
  accountOptions,
}: {
  form: UseFormReturn<MoveFundFormValues, unknown, MoveFundFormOutput>;
  accountOptions: { value: string; label: string }[];
}) {
  const db = useDatabase();
  const [kind, sourceAccountId, sourceContactId] = useWatch({
    control: form.control,
    name: ["kind", "source_account_id", "source_contact_id"],
  });
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!sourceAccountId || !sourceContactId) {
      setRemaining(null);
      return;
    }
    let cancelled = false;
    getRemainingThirdPartyFund(db, sourceAccountId, sourceContactId).then((value) => {
      if (!cancelled) setRemaining(value);
    });
    return () => {
      cancelled = true;
    };
  }, [db, sourceAccountId, sourceContactId]);

  const placeholder = accountOptions.length === 0 ? "Belum ada akun dana pihak ketiga aktif" : "Pilih akun";

  return (
    <>
      <FormFieldSelect form={form} name="kind" label="Jenis" options={KIND_OPTIONS} />
      <Text className="-mt-2 text-xs text-neutral-500">{KIND_HINT[kind]}</Text>

      <FormFieldSelect
        form={form}
        name="source_account_id"
        label="Akun Asal"
        placeholder={placeholder}
        options={accountOptions}
      />
      <FormFieldContact control={form.control} name="source_contact_id" label="Kontak Asal" />
      {remaining != null && (
        <Text className="-mt-2 text-xs text-neutral-500">
          {`Sisa titipan kontak asal di akun asal: ${formatCurrency(remaining)}`}
        </Text>
      )}

      {kind !== "move_ownership" && (
        <FormFieldSelect
          form={form}
          name="destination_account_id"
          label="Akun Tujuan"
          placeholder={placeholder}
          options={accountOptions}
        />
      )}
      {kind !== "move_location" && (
        <FormFieldContact control={form.control} name="destination_contact_id" label="Kontak Tujuan" />
      )}

      <FormFieldNumber form={form} name="amount" label="Nominal" placeholder="0" prefix="Rp" grouped useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan (opsional)" placeholder="Mis. Dipindah ke Jago" />
    </>
  );
}
