"use client";

import { formatCurrency } from "@/lib/format-currency";
import type { AccountWithBalance } from "../../../calculate-balance";
import { MonthPicker } from "./month-picker";
import { AccountMonthStats } from "./account-month-stats";

/** Identitas & info singkat akun — saldo, deskripsi, dan ringkasan
 * pemasukan/pengeluaran bulan yang dipilih lewat MonthPicker. Kartu
 * statistik mengisi sisa ruang vertikal supaya tingginya sejajar dengan
 * panel tab di sisi kanan. */
export function LeftSide({ account }: { account: AccountWithBalance }) {
  return (
    <div className="flex h-full flex-col gap-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Saldo Berjalan</span>
        <span className="font-medium">{formatCurrency(account.balance, "IDR")}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Saldo Awal</span>
        <span>{formatCurrency(account.initial_balance, "IDR")}</span>
      </div>

      {account.description && (
        <div className="space-y-2">
          <p className="text-muted-foreground">Deskripsi</p>
          <p>{account.description}</p>
        </div>
      )}

      <div className="flex flex-1 flex-col space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">Ringkasan Bulanan</p>
          <MonthPicker />
        </div>
        <AccountMonthStats accountId={account.id} />
      </div>
    </div>
  );
}
