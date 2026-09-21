"use client";

import { createContext, useContext } from "react";

import { useCashflowConfig } from "./hooks/use-cashflow-config";

type CashflowConfigContextType = ReturnType<typeof useCashflowConfig>;

const CashflowConfigContext = createContext<CashflowConfigContextType | undefined>(undefined);

/**
 * Context level tab "Konfigurasi" — membungkus `useCashflowConfig`
 * (orkestrator 4 hook fokus di `hooks/`) supaya sub-view section
 * (mapping, mode, field akun, titik awal, auto-sync, tombol sync)
 * masing-masing bisa memanggil `useCashflowConfigContext()` sendiri,
 * bukan menerima props dari `CashflowConfigTab`, lihat
 * docs/rules/state-lifting-vs-context.md.
 */
export function CashflowConfigProvider({ children }: { children: React.ReactNode }) {
  const value = useCashflowConfig();
  return <CashflowConfigContext.Provider value={value}>{children}</CashflowConfigContext.Provider>;
}

export function useCashflowConfigContext() {
  const context = useContext(CashflowConfigContext);
  if (!context) {
    throw new Error("useCashflowConfigContext must be used within CashflowConfigProvider");
  }
  return context;
}
