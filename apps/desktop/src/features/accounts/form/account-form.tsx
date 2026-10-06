"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldText,
  FormFieldCurrency,
  FormFieldNumber,
  FormFieldSelect,
  FormFieldTextarea,
  FormFieldToggleGroup,
  FormFieldIconPicker,
  FormFieldColorPicker,
} from "@/components/forms/form-fields";
import { useAccountGroups } from "@/features/account-groups";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import type { AccountFormOutput, AccountFormValues } from "./account.schema";

type AccountFormProps = {
  form: UseFormReturn<AccountFormValues, unknown, AccountFormOutput>;
  onSubmit: (values: AccountFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** true kalau akun ini sudah punya transaksi/piutang-utang terkait —
   * field "Tipe Akun" dikunci read-only (lihat
   * docs/concept/konsep-tipe-akun.md prinsip #3: tipe permanen setelah
   * dipakai). Worker tetap jadi penjaga akhir (accounts/service.ts
   * isAccountInUse) — ini murni UX supaya user tidak perlu gagal submit
   * dulu baru tahu. */
  accountTypeLocked?: boolean;
};

export function AccountForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  accountTypeLocked = false,
}: AccountFormProps) {
  const { data: groups } = useAccountGroups();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldText
        form={form}
        name="name"
        label="Nama Akun"
        placeholder="Contoh: Kartu Kredit"
      />
      <FormFieldCurrency form={form} name="initial_balance" label="Saldo Awal" />
      <div className="grid grid-cols-2 gap-4">
        <FormFieldIconPicker form={form} name="icon" label="Icon" />
        <FormFieldColorPicker form={form} name="color" label="Warna" />
      </div>
      <FormFieldSelect
        form={form}
        name="group_id"
        label="Group Akun"
        placeholder="Pilih group..."
        allowClear
        clearLabel="Tanpa Group"
        options={
          groups?.map((group) => ({
            value: String(group.id),
            label: group.name,
          })) ?? []
        }
      />
      <FormFieldTextarea
        form={form}
        name="description"
        label="Deskripsi"
        placeholder="Catatan tambahan tentang akun ini (opsional)"
      />
      <FormFieldSelect
        form={form}
        name="account_type"
        label="Tipe Akun"
        disabled={accountTypeLocked}
        options={ACCOUNT_TYPE_OPTIONS.map((option) => ({
          ...option,
          description: accountTypeLocked
            ? `${option.description} Tipe terkunci karena akun ini sudah punya transaksi/piutang-utang terkait.`
            : option.description,
        }))}
      />
      {accountType === "investment" && (
        <div className="grid grid-cols-2 gap-4">
          <FormFieldText
            form={form}
            name="unit_label"
            label="Satuan Unit"
            placeholder="Mis. unit, lembar, gram"
          />
          <FormFieldNumber
            form={form}
            name="current_price_per_unit"
            label="Harga per Unit saat ini"
            placeholder="Mis. 1500"
          />
        </div>
      )}
      <FormFieldToggleGroup
        form={form}
        name="is_active"
        label="Status"
        options={[
          { value: "1", label: "Aktif" },
          { value: "0", label: "Nonaktif" },
        ]}
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
