"use client";

import { createContext, useContext } from "react";

import { useAccounts, type AccountWithBalance } from "@/features/accounts";

interface AccountDetailPageContextType {
  accountId: number;
  account: AccountWithBalance | undefined;
  isLoading: boolean;
}

const AccountDetailPageContext = createContext<AccountDetailPageContextType | undefined>(
  undefined
);

/**
 * Resolve `accountId` (dari query param `?id=`) ke data akun lengkap
 * (`AccountWithBalance`) sekali di level halaman, dipakai bersama oleh
 * `header/` (nama+saldo+tombol kembali) dan `content/` (nanti: transaksi
 * scoped ke akun ini) — lihat "Folder page/" di page-layout.md. Lewat
 * `useAccounts()` yang sudah di-cache react-query (bukan query baru
 * per-akun) supaya konsisten dengan list akun yang sudah termuat di
 * tempat lain.
 */
export function AccountDetailPageProvider({
  accountId,
  children,
}: {
  accountId: number;
  children: React.ReactNode;
}) {
  const { data: accounts, isLoading } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);

  return (
    <AccountDetailPageContext.Provider value={{ accountId, account, isLoading }}>
      {children}
    </AccountDetailPageContext.Provider>
  );
}

export function useAccountDetailPage() {
  const context = useContext(AccountDetailPageContext);
  if (!context) {
    throw new Error("useAccountDetailPage must be used within AccountDetailPageProvider");
  }
  return context;
}
