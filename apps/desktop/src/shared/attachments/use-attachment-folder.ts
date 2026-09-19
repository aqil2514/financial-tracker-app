"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SETTINGS_KEY = "attachment_folder";

export const attachmentFolderQueryKey = ["settings", SETTINGS_KEY];

/**
 * Folder tujuan penyimpanan lampiran foto transaksi. `null`/kosong berarti
 * pakai folder default (app data dir), diselesaikan di sisi Rust —
 * lihat `attachments::default_attachment_dir` di src-tauri.
 */
export function useAttachmentFolder() {
  return useQuery({
    queryKey: attachmentFolderQueryKey,
    queryFn: async (): Promise<string | null> => {
      const db = await getDb();
      const rows = await db.select<{ value: string | null }[]>(
        "SELECT value FROM settings WHERE key = $1",
        [SETTINGS_KEY]
      );
      return rows[0]?.value ?? null;
    },
  });
}

export function useSetAttachmentFolder() {
  return useDbMutation({
    mutationFn: async (folder: string | null) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [SETTINGS_KEY, folder]
      );
    },
    invalidateKey: attachmentFolderQueryKey,
    successMessage: "Folder lampiran berhasil diperbarui",
    errorMessage: "Gagal memperbarui folder lampiran",
  });
}
