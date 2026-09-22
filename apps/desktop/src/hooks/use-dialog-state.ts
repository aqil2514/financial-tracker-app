"use client";

import { useCallback, useState } from "react";

export type DialogState<TType extends string> =
  | { type: TType; dataId: string }
  | { type: TType; dataId?: undefined }
  | null;

export interface UseDialogStateReturn<TType extends string> {
  dialog: DialogState<TType>;
  openDialog: (type: TType, dataId?: string) => void;
  closeDialog: () => void;
  isOpen: (type: TType) => boolean;
}

/**
 * Satu state tunggal `{ type, dataId }` untuk menentukan dialog mana yang
 * sedang aktif dalam satu fitur, menggantikan pola beberapa `useState`
 * terpisah (mis. `activeAccount` + `activeDialog`) yang berpotensi
 * out-of-sync. Dialog dirender sekali di level orkestrator fitur, bukan
 * per item — lihat docs/rules/dialog-pattern.md.
 */
export function useDialogState<TType extends string>(): UseDialogStateReturn<TType> {
  const [dialog, setDialog] = useState<DialogState<TType>>(null);

  const openDialog = useCallback((type: TType, dataId?: string) => {
    setDialog({ type, dataId } as DialogState<TType>);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const isOpen = useCallback((type: TType) => dialog?.type === type, [dialog]);

  return { dialog, openDialog, closeDialog, isOpen };
}
