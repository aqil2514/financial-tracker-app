"use client";

import { useCallback, useState } from "react";
import type { DialogState, UseDialogStateReturn } from "./types";

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
