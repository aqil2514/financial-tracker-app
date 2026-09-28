import { createContext, useContext } from "react";
import { UseCashflowConfigOutput } from "./interfaces";
import { useCashflowConfig } from "./hooks";

type RetailkuSyncCashflowConfigContextType = UseCashflowConfigOutput;

const RetailkuSyncCashflowConfigContext =
  createContext<RetailkuSyncCashflowConfigContextType>(
    {} as RetailkuSyncCashflowConfigContextType,
  );

interface Props {
  children: React.ReactNode;
}

/**
 * Context level halaman "Konfigurasi Sync Retailku" — membungkus
 * `useCashflowConfig` (orkestrator 6 hook fokus di `hooks/`) supaya
 * tiap section di `contents/` bisa memanggil
 * `useRetailkuSyncCashflowConfig()` sendiri, bukan menerima props dari
 * `page.tsx`, mengikuti pola `mapping/context/index.tsx` — lihat
 * docs/rules/state-lifting-vs-context.md.
 */
export function RetailkuSyncCashflowConfigProvider({ children }: Props) {
  const values = useCashflowConfig();

  return (
    <RetailkuSyncCashflowConfigContext.Provider value={values}>
      {children}
    </RetailkuSyncCashflowConfigContext.Provider>
  );
}

export const useRetailkuSyncCashflowConfig = () =>
  useContext(RetailkuSyncCashflowConfigContext);
