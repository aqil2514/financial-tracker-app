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
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { useOngoingDebts } from "@/shared/debts/use-ongoing-debts";
import { useContacts } from "@/shared/contacts/use-contacts";
import { ContactField } from "./contact-field";
import { DebtActionField } from "./debt-action-field";
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
  const contactName = useWatch({ control: form.control, name: "contact_name" });

  const { data: contacts } = useContacts();
  const contactId =
    contacts?.find(
      (contact) => contact.name.toLowerCase() === contactName?.trim().toLowerCase()
    )?.id ?? null;

  // debtStatus dipakai DUA kali: mengunci field berbahaya (di bawah) DAN
  // memastikan piutang yang jadi target pembayaran transaksi ini SENDIRI
  // tetap muncul di checklist DebtActionField meski statusnya sudah
  // 'paid' (lihat use-ongoing-debts.ts) — tanpa ini, edit transaksi yang
  // tadinya melunasi PENUH sebuah piutang tidak bisa memilih ulang
  // piutang yang sama di form.
  const { data: debtStatus } = useTransactionDebtStatus(transactionId);
  const { data: ongoingDebts } = useOngoingDebts(contactId, {
    excludeDebtId: debtStatus?.role === "payment" ? debtStatus.debtId : undefined,
    excludeTransactionId: debtStatus?.role === "payment" ? transactionId : undefined,
  });

  const sourceAccount = accounts?.find((account) => String(account.id) === accountId);
  const destinationAccount = accounts?.find(
    (account) => String(account.id) === transferAccountId
  );
  const sourceIsDebt = sourceAccount?.account_type === "debt";
  const destinationIsDebt = destinationAccount?.account_type === "debt";
  const involvesDebtAccount = sourceIsDebt || destinationIsDebt;

  // Transaksi (mode edit) yang berperan sebagai piutang INDUK dan SUDAH
  // menerima cicilan dari transaksi LAIN — field berbahaya (kontak,
  // nominal, akun, aksi debt) dikunci read-only, karena merevisinya
  // butuh recreate yang akan menghapus cicilan itu lewat CASCADE. Lihat
  // apply-debt-transaction.ts (applyDebtTransactionEdit) dan "Edit
  // transaksi yang sudah py debts terkait" di debt-receivable-tracking.md.
  // Transaksi yang berperan sebagai PEMBAYARAN (bukan induk), atau induk
  // yang belum py cicilan, TETAP bebas diedit — recreate-nya aman.
  const debtFieldsLocked = debtStatus?.role === "principal" && debtStatus.hasPayments;

  // debt -> cash: arah transfer semata ambigu (pelunasan piutang existing
  // vs utang baru) — lihat "Deteksi otomatis debts dari transfer" di
  // debt-receivable-tracking.md. debt -> debt sengaja TIDAK termasuk
  // (di luar scope, tidak trigger apa pun).
  const needsDebtAction =
    !debtFieldsLocked && type === "transfer" && sourceIsDebt && !destinationIsDebt;

  function validateDebtFields(values: TransactionFormOutput): string | null {
    if (debtFieldsLocked) return null;
    if (involvesDebtAccount && !values.contact_name?.trim()) {
      return "Nama kontak wajib diisi untuk transaksi yang melibatkan akun utang piutang";
    }
    if (needsDebtAction) {
      if (!values.debt_action) {
        return "Pilih dulu apakah ini pelunasan piutang atau utang baru";
      }
      if (values.debt_action === "settlement") {
        if (values.settle_debt_ids.length === 0) {
          return "Pilih minimal satu piutang yang dilunasi";
        }
        // Konsisten dengan pola pembayaran nyata yang ditemukan di data
        // ("Kak Ipit Paylater" — pokok & kelebihan SELALU 2 transaksi
        // terpisah) — lihat "Update besar" poin 5 di
        // debt-receivable-tracking.md. Tanpa validasi ini, kelebihan
        // bayar hilang begitu saja (settleDebtsFifo cuma mengalokasikan
        // sampai piutang yang dicentang habis, sisanya dibuang).
        const totalRemaining = (ongoingDebts ?? [])
          .filter((debt) => values.settle_debt_ids.includes(String(debt.id)))
          .reduce((sum, debt) => sum + debt.remaining, 0);
        if (values.amount > totalRemaining) {
          return "Nominal melebihi total sisa piutang yang dipilih — catat kelebihannya sebagai transaksi terpisah";
        }
      }
    }
    return null;
  }

  function handleSubmit(values: TransactionFormOutput) {
    const error = validateDebtFields(values);
    if (error) {
      form.setError(needsDebtAction && values.debt_action ? "settle_debt_ids" : "contact_name", {
        message: error,
      });
      return;
    }
    onSubmit(values);
  }

  function handleSubmitAndContinue(values: TransactionFormOutput) {
    const error = validateDebtFields(values);
    if (error) {
      form.setError(needsDebtAction && values.debt_action ? "settle_debt_ids" : "contact_name", {
        message: error,
      });
      return;
    }
    onSubmitAndContinue?.(values);
  }

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

  // Icon+warna cuma bisa dirender di DALAM dropdown (ComboboxItem) —
  // ComboboxInput adalah text input native, tidak mendukung custom
  // render untuk nilai yang sudah terpilih. Lookup balik ke `accounts`
  // dari option.value karena FormFieldComboboxOption generic cuma bawa
  // {value, label}, tidak bawa data akun mentah.
  function renderAccountOption(option: { value: string; label: string }) {
    const account = accounts?.find((a) => String(a.id) === option.value);
    const AccountIcon = resolveAccountIcon(account?.icon ?? null);
    const colorText = resolveAccountColorText(account?.color ?? null);
    return (
      <span className="flex items-center gap-2">
        <AccountIcon className={`size-4 shrink-0 ${colorText}`} />
        {option.label}
      </span>
    );
  }

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
          {debtFieldsLocked && (
            <p className="text-muted-foreground text-sm">
              Piutang ini sudah menerima cicilan dari transaksi lain — kontak,
              nominal, dan akun tidak bisa diubah dari sini supaya riwayat
              cicilannya tidak hilang.
            </p>
          )}
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
