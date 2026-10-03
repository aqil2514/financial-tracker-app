"use client";

import { useEffect } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";

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
import { ContactField } from "@/features/transactions/form/add-edit/fields/contact-field";
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

const recordModeOptions = [
  { value: "transfer", label: "Dengan Transaksi Kas" },
  { value: "direct", label: "Langsung (tanpa transaksi)" },
];

export function NewDebtForm({ form, onSubmit, isPending }: NewDebtFormProps) {
  const { data: accounts } = useAccounts();

  const debtType = useWatch({ control: form.control, name: "debt_type" });
  const recordMode = useWatch({ control: form.control, name: "record_mode" });

  const cashAccountOptions =
    accounts
      ?.filter((account) => account.account_type === "cash" && account.is_active)
      .map((account) => ({
        value: String(account.id),
        label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
      })) ?? [];

  const debtAccounts = accounts?.filter(
    (account) => account.account_type === "debt" && account.is_active
  );
  const debtAccountOptions =
    debtAccounts?.map((account) => ({
      value: String(account.id),
      label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
    })) ?? [];

  const debtAccountId = useWatch({ control: form.control, name: "debt_account_id" });

  // Prefill akun utang piutang dengan akun debt pertama begitu daftar
  // akun termuat — kebanyakan user cuma punya 1 akun debt (default seed,
  // migrasi 0031), jadi tidak perlu pilih manual setiap kali.
  useEffect(() => {
    if (!debtAccountId && debtAccounts && debtAccounts.length > 0) {
      form.setValue("debt_account_id", String(debtAccounts[0].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtAccounts, debtAccountId]);

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="debt_type"
        label="Jenis"
        options={debtTypeOptions}
      />
      <FormFieldToggleGroup
        form={form}
        name="record_mode"
        label="Cara Mencatat"
        description={
          recordMode === "direct"
            ? "Uang sudah berpindah di luar app (pinjam tunai, barter, dll) — tidak menyentuh saldo akun manapun."
            : "Mencatat lewat transaksi transfer kas <-> akun utang piutang, saldo akun kas ikut berubah."
        }
        options={recordModeOptions}
      />
      <ContactField control={form.control} label="Nama Kontak (wajib)" />
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      {recordMode === "transfer" && (
        <FormFieldCombobox
          form={form}
          name="cash_account_id"
          label="Akun Kas"
          placeholder="Cari akun kas..."
          options={cashAccountOptions}
        />
      )}
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
