"use client";

import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
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

export function useAddAttachment(transactionId: number, targetDir: string | null) {
  return useDbMutation({
    mutationFn: async (input: AddAttachmentInput) => {
      const filePath = await saveFile(input, targetDir);
      const db = await getDb();
      await db.execute(
        "INSERT INTO transaction_attachments (transaction_id, file_path) VALUES ($1, $2)",
        [transactionId, filePath]
      );
    },
    invalidateKey: transactionAttachmentsQueryKey(transactionId),
    successMessage: "Lampiran berhasil ditambahkan",
    errorMessage: "Gagal menambahkan lampiran",
  });
}
