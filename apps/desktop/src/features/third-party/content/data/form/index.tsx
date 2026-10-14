"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { useAccounts } from "@/features/accounts";
import { ContactField } from "@/shared/contacts/contact-field";
import type { ThirdPartyFundFormOutput, ThirdPartyFundFormValues } from "./schemas";

type ThirdPartyFundFormProps = {
  form: UseFormReturn<ThirdPartyFundFormValues, unknown, ThirdPartyFundFormOutput>;
  onSubmit: (values: ThirdPartyFundFormOutput) => void;
  isPending: boolean;
};

const directionOptions = [
  { value: "in", label: "Ada yang Nitip" },
  { value: "out", label: "Ada yang Ambil" },
];

export function ThirdPartyFundForm({ form, onSubmit, isPending }: ThirdPartyFundFormProps) {
  const { data: accounts } = useAccounts();

  const thirdPartyAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "third_party" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="direction"
        label="Jenis"
        options={directionOptions}
      />
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
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
