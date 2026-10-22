"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { ContactField } from "@/shared/contacts/contact-field";
import {
  thirdPartyFundSchema,
  defaultThirdPartyFundValues,
  type ThirdPartyFundFormValues,
  type ThirdPartyFundFormOutput,
} from "@/features/third-party/content/data/form/schemas";

const directionOptions = [
  { value: "in", label: "Ada yang Nitip" },
  { value: "out", label: "Ada yang Ambil" },
];

export function ThirdPartyFundEntryForm({
  defaultValues,
  onChange,
}: {
  defaultValues: Partial<ThirdPartyFundFormValues>;
  onChange: (values: ThirdPartyFundFormOutput | null) => void;
}) {
  const { data: accounts } = useAccounts();

  const form = useForm<ThirdPartyFundFormValues, unknown, ThirdPartyFundFormOutput>({
    resolver: zodResolver(thirdPartyFundSchema),
    defaultValues: { ...defaultThirdPartyFundValues(), ...defaultValues },
  });

  const values = useWatch({ control: form.control });

  useEffect(() => {
    const parsed = thirdPartyFundSchema.safeParse(values);
    onChange(parsed.success ? parsed.data : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `onChange` dipegang parent, tidak perlu di deps
  }, [values]);

  const thirdPartyAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "third_party" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <div className="space-y-4">
      <FormFieldToggleGroup form={form} name="direction" label="Jenis" options={directionOptions} />
      <FormFieldCombobox
        form={form}
        name="account_id"
        label="Akun Dana Pihak Ketiga"
        placeholder="Cari akun..."
        options={thirdPartyAccountOptions}
      />
      <ContactField control={form.control} label="Nama Kontak (wajib)" />
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan" placeholder="Mis. Titip tabungan" />
    </div>
  );
}
