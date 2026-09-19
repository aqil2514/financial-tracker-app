import { invoke } from "@tauri-apps/api/core";

import type { AddAttachmentInput } from "./use-add-attachment";

export type PendingAttachment = {
  id: string;
  previewUrl: string;
  input: AddAttachmentInput;
};

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
  const bytes = await readInputBytes(input);
  const previewUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));

  return { id: crypto.randomUUID(), previewUrl, input };
}

export function revokePendingAttachment(attachment: PendingAttachment) {
  URL.revokeObjectURL(attachment.previewUrl);
}
