"use client";

import { getDb, type Transaction } from "@/lib/db";
import { useEntityForm } from "@/components/forms/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { isEmptyDoc } from "@/components/rich-text";
import { useContacts } from "@/shared/contacts/use-contacts";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { useTransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { applyDebtTransactionEdit } from "@/shared/debts/apply-debt-transaction";
import { applyInvestmentTransactionEdit } from "@/shared/investments/apply-investment-transaction";
import { useTransactionInvestmentPurchase } from "@/shared/investments/use-transaction-investment-purchase";
import { transactionSchema, type TransactionFormOutput } from "../schema";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";

type UseUpdateTransactionOptions = {
  /** Dialog terbuka atau tidak — datang dari context, dipakai untuk
   * resetOnOpen. */
  open: boolean;
  /** Dipanggil setelah transaksi berhasil diperbarui — dipakai pemanggil
   * untuk menutup dialog dari context. Edit tidak punya "Simpan & Lanjut",
   * jadi ini selalu dipanggil setelah submit sukses. */
  onClosed?: () => void;
};

export function useUpdateTransaction(
  transaction: Transaction,
  { open, onClosed }: UseUpdateTransactionOptions
) {
  const { data: contacts } = useContacts();
  const contactName =
    contacts?.find((contact) => contact.id === transaction.contact_id)?.name ?? null;
  const { data: debtStatus } = useTransactionDebtStatus(transaction.id);
  const { data: investmentPurchase } = useTransactionInvestmentPurchase(transaction.id);

  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: transaction.type,
      amount: transaction.amount,
      account_id: transaction.account_id != null ? String(transaction.account_id) : "",
      category_id:
        transaction.category_id != null ? String(transaction.category_id) : null,
      transfer_account_id:
        transaction.transfer_account_id != null
          ? String(transaction.transfer_account_id)
          : null,
      note: transaction.note ?? "",
      description: transaction.description ? JSON.parse(transaction.description) : null,
      date: transaction.date,
      contact_name: contactName,
      // Reset ke kosong (bukan direkonstruksi dari debt_payments lama) —
      // lihat "Edit transaksi yang sudah py debts terkait" di
      // debt-receivable-tracking.md. Kalau field berbahaya diedit ulang
      // pada transaksi yang berperan sebagai pelunasan, user WAJIB pilih
      // ulang aksinya dari awal (transaction-form.tsx yang menampilkan
      // DebtActionField begitu terdeteksi perlu).
      debt_action: null,
      settle_debt_ids: [],
      unit: investmentPurchase?.unit ?? null,
      price_per_unit: investmentPurchase?.price_per_unit ?? null,
    }),
    open,
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);

      const db = await getDb();
      const accountId = values.account_id;
      const transferAccountId =
        values.type === "transfer" ? values.transfer_account_id : null;

      // Field yang mempengaruhi PERHITUNGAN debt — kalau salah satu
      // berubah dari nilai semula, debt/debt_payment terkait (kalau ada)
      // perlu di-recreate dari nilai baru (atau diblokir, tergantung
      // status — lihat applyDebtTransactionEdit). Field lain (note,
      // description, lampiran) tidak pernah mempengaruhi debt sama
      // sekali, jadi tidak perlu dibandingkan.
      const dangerousFieldsChanged =
        values.type !== transaction.type ||
        accountId !== transaction.account_id ||
        transferAccountId !== transaction.transfer_account_id ||
        values.amount !== transaction.amount ||
        contactId !== transaction.contact_id;

      await db.execute(
        `UPDATE transactions
         SET type = $1, amount = $2, category_id = $3, account_id = $4, transfer_account_id = $5, note = $6, description = $7, date = $8, contact_id = $9
         WHERE id = $10`,
        [
          values.type,
          values.amount,
          values.type === "transfer" || !values.category_id
            ? null
            : values.category_id,
          accountId,
          transferAccountId,
          values.note,
          isEmptyDoc(values.description) ? null : JSON.stringify(values.description),
          values.date,
          contactId,
          transaction.id,
        ]
      );

      // debtStatus HARUS sudah termuat sebelum submit bisa terjadi — kalau
      // belum (query belum selesai), lebih aman menolak mutation daripada
      // diam-diam berasumsi role: "none" dan mem-bypass proteksi
      // "piutang sudah dicicil" di applyDebtTransactionEdit.
      if (debtStatus === undefined) {
        throw new Error("Status utang/piutang transaksi ini belum termuat, coba lagi.");
      }

      const touchedDebtRows = await applyDebtTransactionEdit({
        db,
        transactionId: transaction.id,
        type: values.type,
        accountId,
        transferAccountId,
        contactId,
        amount: values.amount,
        date: values.date,
        debtAction: values.debt_action,
        settleDebtIds: values.settle_debt_ids,
        status: debtStatus,
        dangerousFieldsChanged,
      });

      await applyInvestmentTransactionEdit({
        db,
        transactionId: transaction.id,
        type: values.type,
        accountId,
        transferAccountId,
        date: values.date,
        unit: values.unit,
        pricePerUnit: values.price_per_unit,
      });

      void pushOnWrite("transactions", transaction.id);
      for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
      for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);
      // Id LAMA dari RECREATE (field berbahaya berubah) -- Worker tidak
      // pernah tahu id ini harus dihapus kalau cuma mengandalkan push
      // baris baru di atas, lihat komentar TouchedDebtRows.
      for (const debtId of touchedDebtRows.deletedDebtIds) void pushDeleteOnWrite("debts", debtId, {});
      for (const debtPaymentId of touchedDebtRows.deletedDebtPaymentIds)
        void pushDeleteOnWrite("debt_payments", debtPaymentId, {});
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil diperbarui",
    errorMessage: "Gagal memperbarui transaksi",
    onSuccess: async () => {
      onClosed?.();
    },
  });
}
