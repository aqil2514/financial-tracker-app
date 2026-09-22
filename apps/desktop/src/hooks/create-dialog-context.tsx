"use client";

import { createContext, useContext } from "react";
import { useDialogState, type UseDialogStateReturn } from "./use-dialog-state";

/**
 * Factory context untuk state "dialog mana yang aktif" — bungkus
 * useDialogState<TType>() jadi sepasang Provider+useDialog siap pakai,
 * supaya tiap fitur tidak perlu menulis ulang createContext+Provider+
 * useContext+guard error. Dipanggil sekali per fitur, hasilnya di-export
 * ulang dengan nama fitur (mis. TransactionsDialogProvider,
 * useTransactionsDialog). Lihat docs/rules/dialog-pattern.md.
 */
export function createDialogContext<TType extends string>() {
  const DialogContext = createContext<UseDialogStateReturn<TType> | undefined>(undefined);

  function DialogProvider({ children }: { children: React.ReactNode }) {
    const state = useDialogState<TType>();
    return <DialogContext.Provider value={state}>{children}</DialogContext.Provider>;
  }

  function useDialog() {
    const context = useContext(DialogContext);
    if (!context) {
      throw new Error("useDialog must be used within its DialogProvider");
    }
    return context;
  }

  return { DialogProvider, useDialog };
}
