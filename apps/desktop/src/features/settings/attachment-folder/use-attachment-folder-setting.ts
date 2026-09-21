"use client";

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import { useAttachmentFolder, useSetAttachmentFolder } from "@/shared/attachments/use-attachment-folder";

/**
 * State + logic untuk `AttachmentFolderSetting` — folder tersimpan
 * dari `useAttachmentFolder` (null berarti pakai default), plus
 * `defaultDir` yang diselesaikan di sisi Rust (`get_default_attachment_dir`)
 * hanya untuk ditampilkan sebagai informasi saat folder belum di-set.
 */
export function useAttachmentFolderSetting() {
  const { data: folder, isLoading } = useAttachmentFolder();
  const setFolder = useSetAttachmentFolder();
  const [defaultDir, setDefaultDir] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("get_default_attachment_dir")
      .then(setDefaultDir)
      .catch(() => setDefaultDir(null));
  }, []);

  async function handlePickFolder() {
    const selected = await open({ directory: true });
    if (!selected) return;
    setFolder.mutate(selected);
  }

  function handleReset() {
    setFolder.mutate(null);
  }

  return {
    folder,
    activeFolder: folder ?? defaultDir,
    isLoading,
    isSaving: setFolder.isPending,
    handlePickFolder,
    handleReset,
  };
}
