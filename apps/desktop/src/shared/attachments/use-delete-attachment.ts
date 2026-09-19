"use client";

import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import type { TransactionAttachment } from "./use-transaction-attachments";
import { transactionAttachmentsQueryKey } from "./use-transaction-attachments";

export function useDeleteAttachment(transactionId: number) {
  return useDbMutation({
    mutationFn: async (attachment: TransactionAttachment) => {
      const db = await getDb();
      await db.execute("DELETE FROM transaction_attachments WHERE id = $1", [
        attachment.id,
      ]);
      // File fisik dihapus terpisah dari baris DB — kalau ini gagal
      // (mis. file sudah tidak ada), baris DB tetap terhapus karena
      // tujuannya adalah melepas lampiran dari transaksi, bukan menjaga
      // file selalu ada.
      await invoke("delete_attachment_file", { filePath: attachment.file_path }).catch(
        () => undefined
      );
    },
    invalidateKey: transactionAttachmentsQueryKey(transactionId),
    successMessage: "Lampiran berhasil dihapus",
    errorMessage: "Gagal menghapus lampiran",
  });
}
