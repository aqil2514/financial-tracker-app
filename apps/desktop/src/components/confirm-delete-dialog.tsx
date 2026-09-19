"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  title?: string;
  description?: string;
}

/**
 * Versi `ConfirmDeleteButton` tanpa trigger bawaan — dikontrol penuh
 * lewat `open`/`onOpenChange` dari luar. Dipakai saat konfirmasi hapus
 * dipicu dari tempat yang bukan tombol langsung (mis. item di
 * `ListItemActionsMenu`), karena `AlertDialogTrigger` tidak bisa
 * ditempatkan di dalam `DropdownMenuItem` (menu dan dialog sama-sama
 * portal/focus-trap yang saling menutup satu sama lain).
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  title = "Hapus data ini?",
  description = "Tindakan ini tidak bisa dibatalkan.",
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={onConfirm}>
            {isPending ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
