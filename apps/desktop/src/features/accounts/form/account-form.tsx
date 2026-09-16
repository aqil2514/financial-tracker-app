"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldText,
  FormFieldCurrency,
  FormFieldSelect,
  FormFieldTextarea,
} from "@/components/form-fields";
import { useAccountGroups } from "@/features/account-groups";
import type { AccountFormOutput, AccountFormValues } from "./account.schema";

type AccountFormProps = {
  form: UseFormReturn<AccountFormValues, unknown, AccountFormOutput>;
  onSubmit: (values: AccountFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
};

export function AccountForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
}: AccountFormProps) {
  const { data: groups } = useAccountGroups();

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldText
        form={form}
        name="name"
        label="Nama Akun"
        placeholder="Contoh: Kartu Kredit"
      />
      <FormFieldCurrency form={form} name="initial_balance" label="Saldo Awal" />
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
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
