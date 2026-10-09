"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import {
  FormFieldCombobox,
  FormFieldCurrency,
  FormFieldDate,
  FormFieldRichText,
  FormFieldText,
  FormFieldToggleGroup,
} from "@/components/forms/form-fields";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { AccountForm } from "@/features/accounts/form/account-form";
import { useCreateAccount } from "@/features/accounts/form/use-create-account";
import { CategoryForm } from "@/features/categories/form/category-form";
import { useCreateCategory } from "@/features/categories/form/use-create-category";
import { ContactField } from "./fields/contact-field";
import { LabelField } from "@/shared/labels/label-field";
import { useTransactionForm } from "./hooks/use-transaction-form";
import type { TransactionFormOutput, TransactionFormValues } from "./schema";
import { DebtActionField } from "./fields/debt-action-field";
import { InvestmentFields } from "./fields/investment-fields";

type TransactionFormProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  onSubmitAndContinue?: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** Transaksi sudah tersimpan (mode edit) — lampiran langsung disimpan ke DB. */
  transactionId?: string;
  /** Transaksi belum tersimpan (mode create) — lampiran ditunda di memori. */
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (attachments: PendingAttachment[]) => void;
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
  transactionId,
  pendingAttachments,
  onPendingAttachmentsChange,
}: TransactionFormProps) {
  const {
    type,
    accountId,
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    needsInvestmentFields,
    needsInvestmentSellFields,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
    handleSubmitAndContinue,
  } = useTransactionForm({
    form,
    onSubmit,
    onSubmitAndContinue,
    transactionId,
  });

  // Field mana ("account_id" / "transfer_account_id" / "category_id")
  // yang sedang menunggu hasil dialog "buat baru" — null berarti tidak
  // ada dialog yang perlu terbuka. Satu dialog Akun & satu dialog
  // Kategori dipakai bersama oleh kedua combobox akun (sumber/tujuan)
  // supaya tidak perlu 3 instance dialog terpisah.
  const [createAccountFor, setCreateAccountFor] = useState<
    "account_id" | "transfer_account_id" | null
  >(null);
  const [createAccountQuery, setCreateAccountQuery] = useState("");
  const [createCategoryQuery, setCreateCategoryQuery] = useState("");

  const createAccount = useCreateAccount({
    initialValues: { name: createAccountQuery },
    onCreated: (id) => {
      if (createAccountFor)
        form.setValue(createAccountFor, id, { shouldValidate: true });
    },
  });
  const createCategory = useCreateCategory({
    initialValues: {
      name: createCategoryQuery,
      type: type === "income" ? "income" : "expense",
    },
    onCreated: (id) => {
      form.setValue("category_id", id, { shouldValidate: true });
    },
  });

  function openCreateAccount(
    field: "account_id" | "transfer_account_id",
    query: string,
  ) {
    setCreateAccountFor(field);
    setCreateAccountQuery(query);
    createAccount.setOpen(true);
  }

  function openCreateCategory(query: string) {
    setCreateCategoryQuery(query);
    createCategory.setOpen(true);
  }

  return (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid max-h-[70vh] gap-6 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="space-y-4">
            <FormFieldText
              form={form}
              name="note"
              label="Catatan"
              placeholder="Judul singkat transaksi"
            />
            <FormFieldToggleGroup
              form={form}
              name="type"
              label="Tipe Transaksi"
              options={typeOptions}
              disabled={debtFieldsLocked}
            />
            <FormFieldCurrency
              form={form}
              name="amount"
              label={needsInvestmentSellFields ? "Nominal (otomatis dari unit × average cost)" : "Nominal"}
              useCalculator
              disabled={debtFieldsLocked || needsInvestmentSellFields}
            />
            <FormFieldCombobox
              form={form}
              name="account_id"
              label={type === "transfer" ? "Dari Akun" : "Akun"}
              placeholder="Cari akun..."
              options={accountOptions}
              disabled={debtFieldsLocked}
              renderOption={renderAccountOption}
              onCreateNew={
                debtFieldsLocked
                  ? undefined
                  : (query) => openCreateAccount("account_id", query)
              }
            />
            {type === "transfer" ? (
              <FormFieldCombobox
                form={form}
                name="transfer_account_id"
                label="Ke Akun"
                placeholder="Cari akun tujuan..."
                options={accountOptions}
                disabled={debtFieldsLocked}
                renderOption={renderAccountOption}
                onCreateNew={
                  debtFieldsLocked
                    ? undefined
                    : (query) => openCreateAccount("transfer_account_id", query)
                }
              />
            ) : (
              <FormFieldCombobox
                form={form}
                name="category_id"
                label="Kategori"
                placeholder="Cari kategori..."
                options={categoryOptions}
                allowClear
                onCreateNew={openCreateCategory}
              />
            )}
            <ContactField
              control={form.control}
              label={
                involvesDebtAccount
                  ? "Nama Kontak (wajib)"
                  : "Nama Kontak (opsional)"
              }
              disabled={debtFieldsLocked}
            />
            {needsDebtAction && (
              <DebtActionField
                control={form.control}
                transactionId={transactionId}
                debtStatus={debtStatus}
              />
            )}
            <LabelField
              control={form.control}
              scope="transaction_category"
              label="Label"
            />
            {needsInvestmentFields && (
              <InvestmentFields
                form={form}
                isSell={needsInvestmentSellFields}
                investmentAccountId={needsInvestmentSellFields ? accountId : undefined}
              />
            )}
            <FormFieldDate form={form} name="date" label="Tanggal" />
          </div>

          <div className="space-y-4">
            {/* `h-48` (bukan `max-h-48`) WAJIB -- ScrollArea (base-ui)
              Viewport-nya `size-full`, ikut tumbuh mengikuti Root kalau
              Root cuma dibatasi `max-height` tanpa `height` pasti. Tanpa
              ini, grid lampiran yang banyak (>1 baris) overflow KELUAR
              dan menimpa field Deskripsi di bawahnya alih-alih di-scroll
              di dalam box-nya sendiri (bug nyata, 2026-10-09). */}
            <ScrollArea className="h-48">
              {transactionId != null ? (
                <AttachmentUploader transactionId={transactionId} />
              ) : onPendingAttachmentsChange ? (
                <PendingAttachmentUploader
                  pendingAttachments={pendingAttachments ?? []}
                  onChange={onPendingAttachmentsChange}
                  disabled={isPending}
                />
              ) : null}
            </ScrollArea>
            <FormFieldRichText
              form={form}
              name="description"
              label="Deskripsi"
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          {onSubmitAndContinue && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={form.handleSubmit(handleSubmitAndContinue)}
            >
              Lanjut
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : submitLabel}
          </Button>
        </DialogFooter>
      </form>
      {/* Dialog "buat baru" dipicu dari combobox Akun/Kategori di atas —
        HARUS di luar elemen <form> transaksi (bukan cuma lewat portal
        base-ui Dialog): <CategoryForm>/<AccountForm> masing-masing
        punya elemen <form> sendiri, dan nested <form> di DOM membuat
        submit-nya ikut mentrigger submit form transaksi walau
        popup-nya dirender ke luar lewat portal. */}
      <EntityFormDialog
        title="Tambah Akun Baru"
        open={createAccount.open}
        onOpenChange={createAccount.setOpen}
      >
        <AccountForm
          form={createAccount.form}
          onSubmit={createAccount.onSubmit}
          isPending={createAccount.isPending}
        />
      </EntityFormDialog>
      <EntityFormDialog
        title="Tambah Kategori Baru"
        open={createCategory.open}
        onOpenChange={createCategory.setOpen}
      >
        <CategoryForm
          form={createCategory.form}
          onSubmit={createCategory.onSubmit}
          isPending={createCategory.isPending}
        />
      </EntityFormDialog>
    </>
  );
}
