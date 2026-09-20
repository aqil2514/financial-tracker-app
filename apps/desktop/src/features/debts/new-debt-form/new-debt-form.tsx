"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/form-fields";
import { useAccounts } from "@/features/accounts";
import { ContactField } from "@/features/transactions/form/contact-field";
import type { NewDebtFormOutput, NewDebtFormValues } from "./schema";

type NewDebtFormProps = {
  form: UseFormReturn<NewDebtFormValues, unknown, NewDebtFormOutput>;
  onSubmit: (values: NewDebtFormOutput) => void;
  isPending: boolean;
};

const debtTypeOptions = [
  { value: "receivable", label: "Piutang (saya meminjamkan)" },
  { value: "payable", label: "Utang (saya berutang)" },
];

export function NewDebtForm({ form, onSubmit, isPending }: NewDebtFormProps) {
  const { data: accounts } = useAccounts();

  const debtType = useWatch({ control: form.control, name: "debt_type" });

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const debtAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "debt" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="debt_type"
        label="Jenis"
        options={debtTypeOptions}
      />
      <ContactField control={form.control} label="Nama Kontak (wajib)" />
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      <FormFieldCombobox
        form={form}
        name="cash_account_id"
        label="Akun Kas"
        placeholder="Cari akun kas..."
        options={cashAccountOptions}
      />
      <FormFieldCombobox
        form={form}
        name="debt_account_id"
        label="Akun Utang Piutang"
        placeholder="Cari akun utang piutang..."
        options={debtAccountOptions}
      />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText
        form={form}
        name="note"
        label="Catatan"
        placeholder={
          debtType === "receivable"
            ? "Mis. Minjem modal usaha"
            : "Mis. Pinjam buat kebutuhan mendesak"
        }
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
