"use client";

import { createContext, useContext } from "react";
import { useDialogQueryState } from "./use-dialog-query-state";
import type { UseDialogStateReturn } from "../dialog-state";

export function createDialogQueryContext<TType extends string>(paramName?: string) {
  const DialogContext = createContext<UseDialogStateReturn<TType> | undefined>(undefined);

  function DialogProvider({ children }: { children: React.ReactNode }) {
    const state = useDialogQueryState<TType>(paramName);
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
