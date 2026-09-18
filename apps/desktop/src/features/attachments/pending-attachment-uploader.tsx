"use client";

import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAttachmentCapture } from "./use-attachment-capture";
import { toPendingAttachment, type PendingAttachment } from "./pending-attachment";

/**
 * Upload lampiran foto untuk transaksi yang BELUM tersimpan (form Tambah,
 * belum ada transaction_id). Foto ditangkap dan ditampilkan sebagai
 * preview (object URL) di memori — penyimpanan sungguhan ke disk/database
 * baru terjadi setelah transaksi berhasil dibuat (lihat
 * use-create-transaction.ts yang memproses `pendingAttachments` ini).
 */
export function PendingAttachmentUploader({
  pendingAttachments,
  onChange,
  disabled,
}: {
  pendingAttachments: PendingAttachment[];
  onChange: (attachments: PendingAttachment[]) => void;
  disabled?: boolean;
}) {
  const { isDraggingOver, setDropZoneEl, handlePickFile, handlePaste } =
    useAttachmentCapture((inputs) => {
      Promise.all(inputs.map(toPendingAttachment))
        .then((newAttachments) => {
          onChange([...pendingAttachments, ...newAttachments]);
        })
        .catch(() => toast.error("Gagal memuat pratinjau lampiran"));
    });

  function handleRemove(id: string) {
    onChange(pendingAttachments.filter((attachment) => attachment.id !== id));
  }

  return (
    <div className="space-y-2">
      <Label>Lampiran Foto</Label>
      <div
        ref={setDropZoneEl}
        onPaste={handlePaste}
        tabIndex={0}
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 outline-none transition-colors ${
          isDraggingOver ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        {pendingAttachments.map((attachment) => (
          <div
            key={attachment.id}
            className="group relative size-20 overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={attachment.previewUrl}
              alt="Pratinjau lampiran"
              className="size-full object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon-xs"
              className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => handleRemove(attachment.id)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="size-20 flex-col gap-1"
          onClick={handlePickFile}
          disabled={disabled}
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Tambah</span>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Pilih file, seret foto ke sini, atau tempel (paste) gambar hasil
        screenshot/copy image. Lampiran baru benar-benar tersimpan setelah
        transaksi disimpan.
      </p>
    </div>
  );
}
