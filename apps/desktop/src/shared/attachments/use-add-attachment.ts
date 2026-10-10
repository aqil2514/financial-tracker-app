"use client";

import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { transactionAttachmentsQueryKey } from "./use-transaction-attachments";

export type AddAttachmentInput =
  | { source: "path"; path: string }
  | { source: "bytes"; bytes: Uint8Array; fileName: string };

export async function saveFile(input: AddAttachmentInput, targetDir: string | null) {
  if (input.source === "path") {
    return invoke<string>("save_attachment_from_path", {
      sourcePath: input.path,
      targetDir,
    });
  }
  return invoke<string>("save_attachment_bytes", {
    bytes: Array.from(input.bytes),
    originalName: input.fileName,
    targetDir,
  });
}

/**
 * Versi non-hook dari penyimpanan lampiran — dipakai di luar konteks
 * mutation UI biasa, mis. `use-create-transaction.ts` yang memproses
 * beberapa `PendingAttachment` sekaligus setelah transaksi baru berhasil
 * disimpan (jadi baru dapat `transactionId`-nya di titik itu).
 */
export async function saveAttachmentToTransaction(
  transactionId: string,
  input: AddAttachmentInput,
  targetDir: string | null
) {
  const filePath = await saveFile(input, targetDir);
  const db = await getDb();
  const id = newId();
  await db.execute(
    "INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ($1, $2, $3)",
    [id, transactionId, filePath]
  );
  // Non-blocking -- gagal/offline masuk antrian retry, TIDAK menunda
  // atau menggagalkan penyimpanan lampiran lokal (lihat
  // shared/cloud-sync/push-on-write/README.md).
  void pushOnWrite("transaction_attachments", id);
}

export function useAddAttachment(transactionId: string, targetDir: string | null) {
  return useDbMutation({
    mutationFn: (input: AddAttachmentInput) =>
      saveAttachmentToTransaction(transactionId, input, targetDir),
    invalidateKey: transactionAttachmentsQueryKey(transactionId),
    successMessage: "Lampiran berhasil ditambahkan",
    errorMessage: "Gagal menambahkan lampiran",
  });
}
