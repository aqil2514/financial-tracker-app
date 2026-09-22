"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { ContactField } from "./fields/contact-field";
import { useTransactionForm } from "./hooks/use-transaction-form";
import type {
  TransactionFormOutput,
  TransactionFormValues,
} from "./schema";
import { DebtActionField } from "./fields/debt-action-field";

type TransactionFormProps = {
  form: UseFormReturn<TransactionFormValues, unknown, TransactionFormOutput>;
  onSubmit: (values: TransactionFormOutput) => void;
  onSubmitAndContinue?: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** Transaksi sudah tersimpan (mode edit) — lampiran langsung disimpan ke DB. */
  transactionId?: number;
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
    debtStatus,
    involvesDebtAccount,
    debtFieldsLocked,
    needsDebtAction,
    accountOptions,
    categoryOptions,
    renderAccountOption,
    handleSubmit,
    handleSubmitAndContinue,
  } = useTransactionForm({ form, onSubmit, onSubmitAndContinue, transactionId });

  return (
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
            label="Nominal"
            useCalculator
            disabled={debtFieldsLocked}
          />
          <FormFieldCombobox
            form={form}
            name="account_id"
            label={type === "transfer" ? "Dari Akun" : "Akun"}
            placeholder="Cari akun..."
            options={accountOptions}
            disabled={debtFieldsLocked}
            renderOption={renderAccountOption}
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
            />
          ) : (
            <FormFieldCombobox
              form={form}
              name="category_id"
              label="Kategori"
              placeholder="Cari kategori..."
              options={categoryOptions}
              allowClear
            />
          )}
          <ContactField
            control={form.control}
            label={involvesDebtAccount ? "Nama Kontak (wajib)" : "Nama Kontak (opsional)"}
            disabled={debtFieldsLocked}
          />
          {needsDebtAction && (
            <DebtActionField
              control={form.control}
              transactionId={transactionId}
              debtStatus={debtStatus}
            />
          )}
          <FormFieldDate form={form} name="date" label="Tanggal" />
        </div>

        <div className="space-y-4">
          <ScrollArea className="max-h-48">
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
          <FormFieldRichText form={form} name="description" label="Deskripsi" />
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
  );
}
