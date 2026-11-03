import type { CloudSyncCredentials } from "./types";
import type { PushResult } from "./worker-client";

// Batas antara logika sync (bisa diuji dengan SQLite asli) dan I/O file/jaringan native (expo-file-system).
export type AttachmentTransport = {
  fileExists(path: string): boolean;
  upload(
    creds: CloudSyncCredentials,
    args: { id: string; transactionId: string; filePath: string; contentType: string | null }
  ): Promise<PushResult>;
  // Mengunduh isi attachment dan mengembalikan path file lokal tempat disimpannya.
  download(creds: CloudSyncCredentials, args: { id: string; contentType: string | null }): Promise<string>;
  deleteFile(path: string): void;
};

// Modul native baru dimuat saat benar-benar dibutuhkan, supaya tes (Node) tidak ikut mengimpornya.
export async function loadDefaultAttachmentTransport(): Promise<AttachmentTransport> {
  return (await import("./attachment-transport")).attachmentTransport;
}
