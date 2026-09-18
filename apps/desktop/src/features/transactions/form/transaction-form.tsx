"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldCurrency,
  FormFieldDate,
  FormFieldSelect,
  FormFieldTextarea,
  FormFieldToggleGroup,
} from "@/components/form-fields";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import type {
  TransactionFormOutput,
  TransactionFormValues,
} from "./transaction.schema";

type TransactionFormProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  onSubmitAndContinue?: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
};

const typeOptions = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

export function TransactionForm({
  form,
  onSubmit,
  onSubmitAndContinue,
  isPending,
  submitLabel = "Simpan",
}: TransactionFormProps) {
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();

  const type = useWatch({ control: form.control, name: "type" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const transferAccountId = useWatch({
    control: form.control,
    name: "transfer_account_id",
  });
  const categoryId = useWatch({ control: form.control, name: "category_id" });

  // Akun/kategori nonaktif disembunyikan dari opsi baru, tapi tetap
  // ditampilkan kalau sedang dipakai transaksi yang diedit — supaya form
  // edit tidak kehilangan nilai yang sudah tersimpan.
  const accountOptions =
    accounts
      ?.filter(
        (account) =>
          account.is_active ||
          String(account.id) === accountId ||
          String(account.id) === transferAccountId
      )
      .map((account) => ({
        value: String(account.id),
        label: account.name,
      })) ?? [];

  const categoryOptions =
    categories
      ?.filter((category) => category.type === type)
      .filter((category) => category.is_active || String(category.id) === categoryId)
      .map((category) => ({
        value: String(category.id),
        label: category.name,
      })) ?? [];

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="type"
        label="Tipe Transaksi"
        options={typeOptions}
      />
      <FormFieldCurrency
        form={form}
        name="amount"
        label="Nominal"
        useCalculator
      />
      <FormFieldSelect
        form={form}
        name="account_id"
        label={type === "transfer" ? "Dari Akun" : "Akun"}
        placeholder="Pilih akun..."
        options={accountOptions}
      />
      {type === "transfer" ? (
        <FormFieldSelect
          form={form}
          name="transfer_account_id"
          label="Ke Akun"
          placeholder="Pilih akun tujuan..."
          options={accountOptions}
        />
      ) : (
        <FormFieldSelect
          form={form}
          name="category_id"
          label="Kategori"
          placeholder="Pilih kategori..."
          options={categoryOptions}
          allowClear
          clearLabel="Tanpa kategori"
        />
      )}
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldTextarea
        form={form}
        name="note"
        label="Catatan"
        placeholder="Catatan tambahan (opsional)"
      />
      <DialogFooter>
        {onSubmitAndContinue && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={form.handleSubmit(onSubmitAndContinue)}
          >
            Lanjut
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
