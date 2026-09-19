"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
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
  const [previewOpen, setPreviewOpen] = useState(false);

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
    <>
      <div className="group relative size-20 overflow-hidden rounded-lg border">
        {error ? (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            Gagal muat
          </div>
        ) : dataUrl ? (
          <button
            type="button"
            className="block size-full cursor-zoom-in"
            onClick={() => setPreviewOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={dataUrl}
              alt="Lampiran transaksi"
              className="size-full object-cover"
            />
          </button>
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

      {dataUrl && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogPortal>
            <DialogOverlay className="bg-black/90 backdrop-blur-none" />
            {/* Popup dibiarkan menutupi seluruh layar (bukan menyusut
             * mengikuti ukuran gambar) supaya klik di ruang kosong di
             * sekitar foto pasti kena elemen ini, lalu ditutup manual lewat
             * onClick — outside-press bawaan base-ui hanya trigger kalau
             * target klik persis backdrop, bukan area kosong di dalam
             * popup. */}
            <DialogContent
              showCloseButton={false}
              className="top-0! left-0! flex size-full max-w-none! translate-none! cursor-zoom-out items-center justify-center border-none bg-transparent p-0 ring-0"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  setPreviewOpen(false);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt="Lampiran transaksi"
                className="max-h-[90vh] max-w-[90vw] cursor-default rounded-lg object-contain"
              />
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </>
  );
}
