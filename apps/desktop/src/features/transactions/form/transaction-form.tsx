"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

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
} from "@/components/form-fields";
import { useAccounts } from "@/features/accounts";
import { useCategories } from "@/features/categories";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
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
  // Label menyertakan induk (grup akun / kategori induk) karena beberapa
  // akun/kategori berbeda memakai nama yang sama persis.
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
        label: account.group_name
          ? `${account.name} — ${account.group_name}`
          : account.name,
      })) ?? [];

  const categoryOptions =
    categories
      ?.filter((category) => category.type === type)
      .filter((category) => category.is_active || String(category.id) === categoryId)
      .map((category) => {
        const parentName = categories?.find(
          (parent) => parent.id === category.parent_id
        )?.name;
        return {
          value: String(category.id),
          label: parentName ? `${category.name} — ${parentName}` : category.name,
        };
      }) ?? [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 sm:grid-cols-2">
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
          />
          <FormFieldCurrency
            form={form}
            name="amount"
            label="Nominal"
            useCalculator
          />
          <FormFieldCombobox
            form={form}
            name="account_id"
            label={type === "transfer" ? "Dari Akun" : "Akun"}
            placeholder="Cari akun..."
            options={accountOptions}
          />
          {type === "transfer" ? (
            <FormFieldCombobox
              form={form}
              name="transfer_account_id"
              label="Ke Akun"
              placeholder="Cari akun tujuan..."
              options={accountOptions}
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
