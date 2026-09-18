"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAttachmentFolder } from "./use-attachment-folder";
import { useAddAttachment } from "./use-add-attachment";
import { useDeleteAttachment } from "./use-delete-attachment";
import { useTransactionAttachments } from "./use-transaction-attachments";
import { AttachmentThumbnail } from "./attachment-thumbnail";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

/**
 * Upload lampiran foto untuk satu transaksi lewat tiga cara: dialog pilih
 * file OS, drag & drop ke area ini, dan paste (Ctrl/Cmd+V) gambar dari
 * clipboard — dipakai berdiri sendiri, belum dipasang ke form manapun.
 */
export function AttachmentUploader({ transactionId }: { transactionId: number }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropZoneEl, setDropZoneEl] = useState<HTMLDivElement | null>(null);

  const { data: attachmentFolder } = useAttachmentFolder();
  const { data: attachments } = useTransactionAttachments(transactionId);
  const addAttachment = useAddAttachment(transactionId, attachmentFolder ?? null);
  const deleteAttachment = useDeleteAttachment(transactionId);

  const addFromPaths = useCallback(
    (paths: string[]) => {
      paths.forEach((path) => {
        addAttachment.mutate({ source: "path", path });
      });
    },
    [addAttachment]
  );

  // Tauri tidak memakai HTML5 drag-drop biasa (WebView-nya tidak mengisi
  // `File.path`, jadi `event.dataTransfer` tidak bisa dipakai untuk tahu
  // lokasi file di disk) — file path hanya didapat lewat event native
  // window-wide `onDragDropEvent`, jadi posisi kursor perlu dicocokkan
  // manual ke area dropzone ini via getBoundingClientRect.
  useEffect(() => {
    if (!dropZoneEl) return;

    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          const { x, y } = event.payload.position;
          const rect = dropZoneEl.getBoundingClientRect();
          setIsDraggingOver(
            x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
          );
          return;
        }

        setIsDraggingOver(false);
        if (event.payload.type !== "drop") return;

        const { x, y } = event.payload.position;
        const rect = dropZoneEl.getBoundingClientRect();
        const isInsideDropZone =
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        if (!isInsideDropZone) return;

        const imagePaths = event.payload.paths.filter((path) =>
          IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(`.${ext}`))
        );
        if (imagePaths.length === 0) {
          toast.error("File yang di-drop bukan gambar");
          return;
        }
        addFromPaths(imagePaths);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
  }, [dropZoneEl, addFromPaths]);

  async function handlePickFile() {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Gambar", extensions: IMAGE_EXTENSIONS }],
    });
    if (!selected) return;
    addFromPaths(Array.isArray(selected) ? selected : [selected]);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData.items).filter((item) =>
      item.type.startsWith("image/")
    );
    if (items.length === 0) return;

    event.preventDefault();
    try {
      const clipboardImage = await readImage();
      const rgba = await clipboardImage.rgba();
      const size = await clipboardImage.size();
      const pngBytes = await rgbaToPngBytes(rgba, size.width, size.height);
      addAttachment.mutate({
        source: "bytes",
        bytes: pngBytes,
        fileName: "clipboard.png",
      });
    } catch {
      toast.error("Gagal membaca gambar dari clipboard");
    }
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
        {attachments?.map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onRemove={() => deleteAttachment.mutate(attachment)}
            isRemoving={deleteAttachment.isPending}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="size-20 flex-col gap-1"
          onClick={handlePickFile}
          disabled={addAttachment.isPending}
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Tambah</span>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Pilih file, seret foto ke sini, atau tempel (paste) dari clipboard.
      </p>
    </div>
  );
}

async function rgbaToPngBytes(
  rgba: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia");

  const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Gagal meng-encode gambar clipboard ke PNG");

  return new Uint8Array(await blob.arrayBuffer());
}
