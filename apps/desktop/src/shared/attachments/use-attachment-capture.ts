"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";

import type { AddAttachmentInput } from "./use-add-attachment";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

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

/**
 * Menangkap input foto lewat tiga cara (dialog pilih file, drag & drop,
 * paste clipboard) dan menyerahkan hasilnya sebagai `AddAttachmentInput[]`
 * lewat `onCapture` — terpisah dari logic PENYIMPANAN (langsung ke DB vs
 * ditunda di memori) supaya kedua mode uploader bisa berbagi kode ini.
 */
export function useAttachmentCapture(onCapture: (inputs: AddAttachmentInput[]) => void) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dropZoneEl, setDropZoneEl] = useState<HTMLDivElement | null>(null);

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
        const rect = dropZoneEl.getBoundingClientRect();
        // event.payload.position dari Tauri dalam PHYSICAL pixels, sedangkan
        // getBoundingClientRect() dalam LOGICAL/CSS pixels — di layar dengan
        // DPI scaling (mis. 125%/150%, umum di Windows) keduanya tidak akan
        // pernah cocok kalau dibandingkan langsung, sehingga dropzone
        // "tidak pernah terlihat aktif". Perlu dibagi devicePixelRatio dulu.
        const scale = window.devicePixelRatio || 1;
        const isInside = (x: number, y: number) => {
          const logicalX = x / scale;
          const logicalY = y / scale;
          return (
            logicalX >= rect.left &&
            logicalX <= rect.right &&
            logicalY >= rect.top &&
            logicalY <= rect.bottom
          );
        };

        if (event.payload.type === "over") {
          setIsDraggingOver(isInside(event.payload.position.x, event.payload.position.y));
          return;
        }

        setIsDraggingOver(false);
        if (event.payload.type !== "drop") return;
        if (!isInside(event.payload.position.x, event.payload.position.y)) return;

        const imagePaths = event.payload.paths.filter((path) =>
          IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(`.${ext}`))
        );
        if (imagePaths.length === 0) {
          toast.error("File yang di-drop bukan gambar");
          return;
        }
        onCapture(imagePaths.map((path) => ({ source: "path", path })));
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropZoneEl]);

  const handlePickFile = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Gambar", extensions: IMAGE_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    onCapture(paths.map((path) => ({ source: "path", path })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCapture]);

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
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
        onCapture([{ source: "bytes", bytes: pngBytes, fileName: "clipboard.png" }]);
      } catch {
        // readImage() hanya bisa membaca clipboard berisi data bitmap
        // gambar (mis. hasil screenshot atau "Copy image" dari browser).
        // Meng-copy FILE gambar dari File Explorer (Ctrl+C) menaruh
        // referensi path ke clipboard (format CF_HDROP di Windows), bukan
        // data bitmap — itu bukan yang didukung di sini, jadi errornya
        // perlu dibedakan dari kegagalan teknis lain supaya user tahu
        // harus pakai tombol "Tambah" atau drag & drop untuk kasus itu.
        toast.error(
          "Clipboard tidak berisi gambar yang bisa ditempel. Jika Anda meng-copy file dari File Explorer, gunakan tombol \"Tambah\" atau seret filenya ke sini."
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onCapture]
  );

  return { isDraggingOver, setDropZoneEl, handlePickFile, handlePaste };
}
