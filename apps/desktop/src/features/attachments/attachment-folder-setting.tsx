"use client";

import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAttachmentFolder, useSetAttachmentFolder } from "./use-attachment-folder";

/**
 * Pengaturan folder tempat file lampiran foto transaksi disimpan.
 * Kosong (null di database) berarti pakai folder default di app data dir,
 * yang path-nya diselesaikan di sisi Rust — diambil di sini hanya untuk
 * ditampilkan sebagai informasi.
 */
export function AttachmentFolderSetting() {
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

  const activeFolder = folder ?? defaultDir;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        Lokasi penyimpanan file foto yang dilampirkan ke transaksi.
      </p>
      <div className="flex items-center gap-2 rounded-lg border p-2.5">
        <FolderOpen className="text-muted-foreground size-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm" title={activeFolder ?? undefined}>
          {isLoading ? "Memuat..." : (activeFolder ?? "-")}
        </p>
        {!folder && (
          <span className="text-muted-foreground shrink-0 text-xs">(default)</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePickFolder}
          disabled={setFolder.isPending}
        >
          Pilih Folder Lain
        </Button>
        {folder && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={setFolder.isPending}
          >
            <RotateCcw className="size-3.5" />
            Pakai Default
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Mengubah folder tidak memindahkan file lampiran yang sudah ada —
        hanya berlaku untuk lampiran baru.
      </p>
    </div>
  );
}
