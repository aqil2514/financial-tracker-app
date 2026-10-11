"use client";

import { createContext, useContext } from "react";
import { useDialogState } from "./use-dialog-state";
import type { UseDialogStateReturn } from "./types";

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
