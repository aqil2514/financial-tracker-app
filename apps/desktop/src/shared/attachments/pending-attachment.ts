import { invoke } from "@tauri-apps/api/core";

import type { AddAttachmentInput } from "./use-add-attachment";
import { isPdfAttachment } from "./attachment-thumbnail";

export type PendingAttachment = {
  id: string;
  previewUrl: string;
  isPdf: boolean;
  input: AddAttachmentInput;
};

function inputFileName(input: AddAttachmentInput): string {
  return input.source === "path" ? input.path : input.fileName;
}

/**
 * Membaca bytes lampiran sebelum disimpan permanen — dipakai untuk
 * preview instan (`toPendingAttachment`) dan juga oleh proses penyimpanan
 * akhir kalau suatu saat perlu isi filenya, bukan cuma path-nya.
 */
async function readInputBytes(input: AddAttachmentInput): Promise<Uint8Array> {
  if (input.source === "bytes") return input.bytes;
  const bytes = await invoke<number[]>("read_attachment_bytes", {
    filePath: input.path,
  });
  return new Uint8Array(bytes);
}

/**
 * Membungkus `AddAttachmentInput` jadi preview instan lewat
 * `URL.createObjectURL` — dipakai SEBELUM transaksi (dan `transaction_id`-
 * nya) tersimpan, jadi belum menyentuh folder lampiran permanen sama
 * sekali. Penyimpanan sungguhan baru terjadi lewat `useAddAttachment`
 * setelah transaksi berhasil dibuat.
 */
export async function toPendingAttachment(
  input: AddAttachmentInput
): Promise<PendingAttachment> {
  const isPdf = isPdfAttachment(inputFileName(input));
  // PDF tidak pernah dirender sebagai <img> -- tidak perlu baca bytes
  // sama sekali untuk preview, cukup tahu itu PDF (lihat
  // PendingAttachmentUploader). Hindari baca file besar dua kali.
  if (isPdf) {
    return { id: crypto.randomUUID(), previewUrl: "", isPdf: true, input };
  }

  const bytes = await readInputBytes(input);
  const previewUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));

  return { id: crypto.randomUUID(), previewUrl, isPdf: false, input };
}

export function revokePendingAttachment(attachment: PendingAttachment) {
  URL.revokeObjectURL(attachment.previewUrl);
}
