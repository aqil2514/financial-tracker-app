"use client";

import { createContext, useContext } from "react";

import { useMappingDraft } from "./hooks/use-mapping-draft";

type MappingContextType = ReturnType<typeof useMappingDraft>;

const MappingContext = createContext<MappingContextType | undefined>(undefined);

/**
 * Context level tab "Mapping" — pola sama dengan `CashflowConfigProvider`
 * (lihat docs/rules/state-lifting-vs-context.md), TAPI provider TERPISAH
 * dari `CashflowConfigProvider` karena fiturnya independen (bukan bagian
 * orkestrasi tab Konfigurasi) — lihat
 * docs/todos/plan/retailku-sync-field-mapping.md.
 */
export function MappingProvider({ children }: { children: React.ReactNode }) {
  const value = useMappingDraft();
  return <MappingContext.Provider value={value}>{children}</MappingContext.Provider>;
}

export function useMappingContext() {
  const context = useContext(MappingContext);
  if (!context) {
    throw new Error("useMappingContext must be used within MappingProvider");
  }
  return context;
}
