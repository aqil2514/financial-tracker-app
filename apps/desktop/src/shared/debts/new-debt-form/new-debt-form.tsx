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
import { ContactField } from "@/shared/contacts/contact-field";
import type { NewDebtFormOutput, NewDebtFormValues } from "./schema";

type NewDebtFormProps = {
  form: UseFormReturn<NewDebtFormValues, unknown, NewDebtFormOutput>;
  onSubmit: (values: NewDebtFormOutput) => void;
  isPending: boolean;
};

const DEBT_TYPE_LABEL: Record<"receivable" | "payable", string> = {
  receivable: "Piutang",
  payable: "Utang",
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

  // Hanya akun debt yang `direction`-nya cocok `debt_type` yang sedang
  // dipilih (atau 'both') -- bukan SEMUA akun account_type='debt' seperti
  // sebelumnya. Mencegah entri Utang tersimpan ke akun "Piutang" (dan
  // sebaliknya), lihat docs/dogfooding/2026-10-16-....md untuk bug nyata
  // yang ditemukan dari gap ini.
  const debtAccounts = accounts?.filter(
    (account) =>
      account.account_type === "debt" &&
      account.is_active &&
      (account.debt_direction === debtType || account.debt_direction === "both")
  );
  const debtAccountOptions =
    debtAccounts?.map((account) => ({
      value: String(account.id),
      label: account.group_name ? `${account.name} — ${account.group_name}` : account.name,
    })) ?? [];

  const debtAccountId = useWatch({ control: form.control, name: "debt_account_id" });

  // Key stabil dari isi debtAccounts (bukan identitas array, yang selalu
  // baru tiap render karena hasil .filter()) -- dipakai sbg dependency
  // useEffect supaya re-prefill HANYA jalan saat daftar akun yang cocok
  // benar-benar berubah (mis. toggle debt_type), bukan tiap re-render.
  // Percobaan pertama yang dibuang gagal persis di titik ini.
  const debtAccountIds = debtAccounts?.map((a) => a.id).join(",") ?? "";

  // Auto-select kalau cuma ada 1 opsi yang cocok; kalau field sudah
  // terisi akun yang MASIH ada di daftar cocok, biarkan (tidak menimpa
  // pilihan manual user); selain itu kosongkan supaya user pilih manual.
  useEffect(() => {
    if (!debtAccounts) return;
    const current = form.getValues("debt_account_id");
    const currentStillValid = current != null && debtAccounts.some((a) => String(a.id) === current);
    if (currentStillValid) return;
    form.setValue("debt_account_id", debtAccounts.length === 1 ? String(debtAccounts[0].id) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtAccountIds]);

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
      <div className="space-y-1">
        <FormFieldCombobox
          form={form}
          name="debt_account_id"
          label="Akun Utang Piutang"
          placeholder="Cari akun utang piutang..."
          options={debtAccountOptions}
        />
        {debtAccountOptions.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Belum ada akun {DEBT_TYPE_LABEL[debtType]} — buat dulu lewat Tambah Akun.
          </p>
        )}
      </div>
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
