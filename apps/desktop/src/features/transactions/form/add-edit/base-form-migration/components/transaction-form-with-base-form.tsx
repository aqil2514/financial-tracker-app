"use client";

/**
 * PATOKAN/REFERENSI — BELUM di-wire ke mana pun, JANGAN diimpor dari
 * tempat lain. Percobaan membuat TransactionForm langsung dari
 * `@/components/forms/base-form` (pola yang sudah dipakai
 * `AccountForm`/`CategoryForm`/dst), sebagai pembanding terhadap
 * `TransactionBaseForm` (wrapper khusus yang menerima `form` sudah jadi
 * dari luar, lihat ../../components/transaction-base-form.tsx) yang
 * dipakai saat ini.
 *
 * Seluruh folder `base-form-migration/` (komponen + hook) menampung
 * patokan migrasi form transaksi utama ke pola `BaseForm` — dipisah
 * dari `components/`/`hooks/` yang lama supaya gampang dibedakan/
 * dibersihkan nanti, lihat README di folder ini.
 *
 * Beda kunci dari TransactionForm asli (../../components/index.tsx):
 * - `BaseForm` MEMBUAT `useForm`-nya SENDIRI dari `schema`+`defaultValues`
 *   (prop), bukan terima `form` yang sudah jadi dari `useCreateTransaction`/
 *   `useUpdateTransaction` (`useEntityForm`).
 * - Konsekuensi: `useTransactionForm()` (butuh `form` buat `useWatch`
 *   dkk) baru bisa dipanggil DI DALAM render-prop `children(form)`,
 *   bukan di level komponen seperti sekarang — field-field kompleks
 *   (account_id/amount/dst) TETAP butuh context pembungkus kalau mau
 *   dipecah ke file sendiri (lihat catatan di
 *   docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md),
 *   TIDAK diselesaikan di file patokan ini.
 * - Rules of Hooks: `children(form)` di base-form.tsx dipanggil LANGSUNG
 *   (bukan lewat JSX terpisah) di dalam render `BaseForm`, pada urutan
 *   yang sama setiap render — hook (`useTransactionForm`/`useCreateAccount`)
 *   yang dipanggil di dalam callback ini AMAN selama urutan & jumlah
 *   panggilannya tetap konsisten tiap render, TIDAK bersyarat. Tetap
 *   berisiko bikin bingung reviewer karena "terlihat" seperti hook di
 *   dalam function biasa — pertimbangkan ini salah satu alasan untuk TIDAK
 *   pakai pola render-prop kalau jadi solusi final nanti.
 * - `onSubmit`/mutation (create vs update) TIDAK bisa lagi dibedakan di
 *   titik ini seperti sekarang (form dipakai bersama) — `BaseForm` cuma
 *   terima SATU `onSubmit`, jadi pola create/update terpisah
 *   (`useCreateTransaction`/`useUpdateTransaction`) perlu dipikirkan
 *   ulang di level pemanggil (dialog), BUKAN di sini.
 */

import { useState } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BaseForm } from "@/components/forms/base-form";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { FormFieldCombobox, FormFieldCurrency, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { AccountForm, defaultAccountValues, useCreateAccount } from "@/features/accounts";
import { CategoryForm } from "@/features/categories/content/list/form/category-form";
import { useCreateCategory } from "@/features/categories/content/list/form/use-create-category";
import { ContactField } from "../../fields/contact-field";
import { LabelField } from "@/shared/labels/label-field";
import { useTransactionForm } from "../../hooks/use-transaction-form";
import { transactionSchema, defaultTransactionValues } from "../../schema";
import type { TransactionFormOutput, TransactionFormValues } from "../../schema";
import { DebtActionField } from "../../fields/debt-action-field";
import { InvestmentFields } from "../../fields/investment-fields";
import { FieldNote } from "../../components/fields/field-note";
import { FieldDate } from "../../components/fields/field-date";
import { FieldDescription } from "../../components/fields/field-description";

type TransactionFormWithBaseFormProps = {
  defaultValues: Partial<TransactionFormValues>;
  onSubmit: (values: TransactionFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  transactionId?: string;
  pendingAttachments?: PendingAttachment[];
  onPendingAttachmentsChange?: (attachments: PendingAttachment[]) => void;
};

const typeOptions = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
  { value: "transfer", label: "Transfer" },
];

export function TransactionFormWithBaseForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  transactionId,
  pendingAttachments,
  onPendingAttachmentsChange,
}: TransactionFormWithBaseFormProps) {
  const [createAccountFor, setCreateAccountFor] = useState<
    "account_id" | "transfer_account_id" | null
  >(null);
  const [createAccountQuery, setCreateAccountQuery] = useState("");
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [createCategoryQuery, setCreateCategoryQuery] = useState("");

  const createCategory = useCreateCategory({
    initialValues: { name: createCategoryQuery, type: "expense" },
    onCreated: () => {},
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
    <BaseForm<TransactionFormValues, TransactionFormOutput>
      schema={transactionSchema}
      defaultValues={{ ...defaultTransactionValues(), ...defaultValues }}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
    >
      {(form) => {
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
        } = useTransactionForm({
          form,
          onSubmit,
          transactionId,
        });

        const createAccount = useCreateAccount({
          onCreated: (id) => {
            setCreateAccountOpen(false);
            if (createAccountFor)
              form.setValue(createAccountFor, id, { shouldValidate: true });
          },
        });

        return (
          <>
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
      }}
    </BaseForm>
  );
}
