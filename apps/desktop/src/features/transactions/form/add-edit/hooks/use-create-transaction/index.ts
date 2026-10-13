"use client";

import { toast } from "sonner";

import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { saveAttachmentToTransaction } from "@/shared/attachments/use-add-attachment";
import { useEntityForm } from "@/components/forms/hooks/use-entity-form";
import { transactionSchema } from "../../schema";
import type { UseCreateTransactionOptions } from "./type";
import { createTransaction } from "./create-transaction";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function useCreateTransaction(options: UseCreateTransactionOptions) {
  const {
    open,
    getPendingAttachments,
    attachmentFolder = null,
    onAttachmentsSaved,
    onClosed,
    defaultAccountId,
  } = options;

  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: "expense" as const,
      amount: 0,
      account_id: defaultAccountId != null ? String(defaultAccountId) : "",
      category_id: null,
      transfer_account_id: null,
      note: "",
      description: null,
      date: now(),
      contact_name: null,
      debt_action: null,
      settle_debt_ids: [],
      unit: null,
      price_per_unit: null,
      investment_status: "pending" as const,
      label_names: [],
    }),
    open,
    resetOnOpen: true,
    mutationFn: createTransaction,
    onSuccess: async (transactionId, { keepOpen }) => {
      const pending = getPendingAttachments?.() ?? [];

      if (transactionId != null && pending.length > 0) {
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
          onAttachmentsSaved?.();
        }
      }

      if (!keepOpen) onClosed?.();
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
  });
}
