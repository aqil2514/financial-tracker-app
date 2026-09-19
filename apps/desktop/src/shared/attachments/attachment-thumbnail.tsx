"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TransactionAttachment } from "./use-transaction-attachments";

export function guessMimeType(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

// String.fromCharCode(...bytes) langsung akan melebihi batas argumen
// fungsi untuk file besar, dan reduce per-byte adalah O(n^2) — dipotong
// per-chunk supaya tetap cepat untuk foto ukuran beberapa MB.
const CHUNK_SIZE = 8192;

export function bytesToDataUrl(bytes: number[], filePath: string) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);
  return `data:${guessMimeType(filePath)};base64,${base64}`;
}

export function AttachmentThumbnail({
  attachment,
  onRemove,
  isRemoving,
}: {
  attachment: TransactionAttachment;
  onRemove?: () => void;
  isRemoving?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(false);

    invoke<number[]>("read_attachment_bytes", { filePath: attachment.file_path })
      .then((bytes) => {
        if (!cancelled) setDataUrl(bytesToDataUrl(bytes, attachment.file_path));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.file_path]);

  return (
    <div className="group relative size-20 overflow-hidden rounded-lg border">
      {error ? (
        <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
          Gagal muat
        </div>
      ) : dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="Lampiran transaksi"
          className="size-full object-cover"
        />
      ) : (
        <div className="bg-muted size-full animate-pulse" />
      )}
      {onRemove && (
        <Button
          type="button"
          variant="destructive"
          size="icon-xs"
          className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
          disabled={isRemoving}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
