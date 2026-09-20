"use client";

import { toast } from "sonner";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { isEmptyDoc } from "@/components/rich-text";
import { saveAttachmentToTransaction } from "@/shared/attachments/use-add-attachment";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import type { PendingAttachment } from "@/shared/attachments/pending-attachment";
import {
  transactionSchema,
  type TransactionFormOutput,
} from "./transaction.schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

type UseCreateTransactionOptions = {
  /** Lampiran yang ditangkap sebelum transaksi tersimpan — diproses
   * (disimpan ke disk + database) setelah insert transaksi berhasil,
   * karena baru di titik itu `transaction_id`-nya diketahui. Dibaca lewat
   * getter (bukan array langsung) supaya selalu ambil state terbaru dari
   * form saat submit terjadi, bukan snapshot saat hook di-mount. */
  getPendingAttachments?: () => PendingAttachment[];
  attachmentFolder?: string | null;
  onAttachmentsSaved?: () => void;
};

export function useCreateTransaction(options: UseCreateTransactionOptions = {}) {
  const { getPendingAttachments, attachmentFolder = null, onAttachmentsSaved } = options;

  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: "expense" as const,
      amount: 0,
      account_id: "",
      category_id: null,
      transfer_account_id: null,
      note: "",
      description: null,
      date: now(),
      contact_name: null,
      debt_action: null,
      settle_debt_ids: [],
    }),
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const contactId = await resolveContactId(values.contact_name);

      const db = await getDb();
      const accountId = Number(values.account_id);
      const transferAccountId =
        values.type === "transfer" ? Number(values.transfer_account_id) : null;

      const result = await db.execute(
        `INSERT INTO transactions (type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          values.type,
          values.amount,
          values.type === "transfer" || !values.category_id
            ? null
            : Number(values.category_id),
          accountId,
          transferAccountId,
          values.note,
          isEmptyDoc(values.description) ? null : JSON.stringify(values.description),
          values.date,
          contactId,
        ]
      );
      const transactionId = result.lastInsertId ?? null;

      if (transactionId != null) {
        await applyDebtTransaction({
          db,
          transactionId,
          type: values.type,
          accountId,
          transferAccountId,
          contactId,
          amount: values.amount,
          date: values.date,
          debtAction: values.debt_action,
          settleDebtIds: values.settle_debt_ids,
        });
      }

      return transactionId;
    },
    onSuccess: async (transactionId) => {
      const pending = getPendingAttachments?.() ?? [];
      if (transactionId == null || pending.length === 0) return;

      // Transaksinya sendiri sudah tersimpan di titik ini — kegagalan
      // menyimpan lampiran TIDAK boleh dilempar sebagai error mutation
      // (useDbMutation.onError hanya menangkap error dari mutationFn,
      // bukan dari onSuccess), jadi ditangani sendiri di sini supaya user
      // tetap dapat feedback yang jelas alih-alih unhandled rejection.
      try {
        await Promise.all(
          pending.map((attachment) =>
            saveAttachmentToTransaction(transactionId, attachment.input, attachmentFolder)
          )
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        toast.error(`Transaksi tersimpan, tapi lampiran gagal disimpan: ${detail}`);
      } finally {
        // Dialog/form tetap reset setelah ini (perilaku useEntityForm) —
        // pending attachments yang gagal tidak bisa "dicoba ulang" dari
        // form yang sudah reset, jadi tetap dibersihkan baik sukses
        // maupun gagal supaya tidak ada state foto "hantu" yang tersisa.
        onAttachmentsSaved?.();
      }
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
  });
}
