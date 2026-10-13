"use client";

import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { FormFieldCombobox, FormFieldCurrency, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { AccountForm, defaultAccountValues, useCreateAccount } from "@/features/accounts";
import { CategoryForm } from "@/features/categories/content/list/form/category-form";
import { useCreateCategory } from "@/features/categories/content/list/form/use-create-category";
import { ContactField } from "../fields/contact-field";
import { LabelField } from "@/shared/labels/label-field";
import { useTransactionForm } from "../hooks/use-transaction-form";
import type { TransactionFormOutput, TransactionFormValues } from "../schema";
import { DebtActionField } from "../fields/debt-action-field";
import { InvestmentFields } from "../fields/investment-fields";
import { FieldNote } from "./fields/field-note";
import { FieldDate } from "./fields/field-date";
import { FieldDescription } from "./fields/field-description";
import { TransactionBaseForm } from "./transaction-base-form";

type TransactionFormProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
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
  } = useTransactionForm({
    form,
    onSubmit,
    transactionId,
  });

  const [createAccountFor, setCreateAccountFor] = useState<
    "account_id" | "transfer_account_id" | null
  >(null);
  const [createAccountQuery, setCreateAccountQuery] = useState("");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [createCategoryQuery, setCreateCategoryQuery] = useState("");

  const createAccount = useCreateAccount({
    onCreated: (id) => {
      setCreateAccountOpen(false);
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
    setCreateAccountOpen(true);
  }

  function openCreateCategory(query: string) {
    setCreateCategoryQuery(query);
    createCategory.setOpen(true);
  }

  return (
    <>
      <TransactionBaseForm form={form} onSubmit={handleSubmit} isPending={isPending} submitLabel={submitLabel}>
        <div className="grid max-h-[70vh] gap-6 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="space-y-4">
            <FieldNote />
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
            <FieldDate />
          </div>

          <div className="space-y-4">
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
            <FieldDescription />
          </div>
        </div>
      </TransactionBaseForm>
      <Dialog open={createAccountOpen} onOpenChange={setCreateAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Akun Baru</DialogTitle>
          </DialogHeader>
          <AccountForm
            defaultValues={{ ...defaultAccountValues(), name: createAccountQuery }}
            onSubmit={createAccount.onSubmit}
            isPending={createAccount.isPending}
          />
        </DialogContent>
      </Dialog>
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
