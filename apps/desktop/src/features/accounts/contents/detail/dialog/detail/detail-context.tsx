"use client";

import { createContext, useContext, useState } from "react";
import { startOfMonth } from "date-fns";

export type AccountDetailTab = "recent" | "month" | "detail";

interface AccountDetailContextType {
  /** Bulan terpilih (dinormalisasi ke tanggal 1) — dipakai bersama oleh
   * chart di sisi kiri dan tab "Bulan Ini" di sisi kanan supaya keduanya
   * selalu menampilkan periode yang sama. */
  selectedMonth: Date;
  setSelectedMonth: (month: Date) => void;
  /** Tab aktif di sisi kanan — dikontrol (bukan defaultValue) supaya
   * klik transaksi di tab Terbaru/Bulan Ini bisa memindahkan tab
   * otomatis ke Detail. */
  activeTab: AccountDetailTab;
  setActiveTab: (tab: AccountDetailTab) => void;
  /** Transaksi yang sedang dipilih untuk ditampilkan di tab Detail. */
  selectedTransactionId: string | null;
  selectTransaction: (id: string) => void;
  /** Menutup dialog detail akun ini sendiri — dipakai tombol "Edit" di
   * tab Detail sebelum navigasi ke halaman Transaksi, supaya dialog
   * akun tidak menumpuk di belakang dialog edit transaksi. */
  closeParentDialog: () => void;
}

const AccountDetailContext = createContext<AccountDetailContextType | undefined>(undefined);

export function AccountDetailProvider({
  children,
  onCloseParentDialog,
}: {
  children: React.ReactNode;
  onCloseParentDialog: () => void;
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [activeTab, setActiveTab] = useState<AccountDetailTab>("recent");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  function selectTransaction(id: string) {
    setSelectedTransactionId(id);
    setActiveTab("detail");
  }

  return (
    <AccountDetailContext.Provider
      value={{
        selectedMonth,
        setSelectedMonth,
        activeTab,
        setActiveTab,
        selectedTransactionId,
        selectTransaction,
        closeParentDialog: onCloseParentDialog,
      }}
    >
      {children}
    </AccountDetailContext.Provider>
  );
}

export function useAccountDetail() {
  const context = useContext(AccountDetailContext);
  if (!context) {
    throw new Error("useAccountDetail must be used within AccountDetailProvider");
  }
  return context;
}
