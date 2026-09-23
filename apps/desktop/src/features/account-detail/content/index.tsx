"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TransactionListContent,
  TransactionListFooter,
  useTransactionsDialog,
} from "@/features/transactions";
import { useAccountDetailPage } from "../page/account-detail-page-context";

/** Badan halaman detail akun — daftar transaksi yang melibatkan akun ini
 * (baik sebagai akun utama maupun tujuan transfer). Reuse penuh
 * `ListCardContent`/`ListCardFooter` dari `features/transactions` —
 * `TransactionListProvider`-nya sendiri dipasang di `page/` (lihat
 * `AccountDetailTransactionListProvider`), bukan di sini, karena
 * `header/` (filter+sort) ikut mengonsumsi context yang sama. Tombol
 * "Tambah Transaksi" membuka dialog create yang sama dengan halaman
 * Transaksi (provider+dialognya dipasang di `page.tsx`, bukan di sini —
 * lihat page-layout.md), dengan `account_id` sudah otomatis terisi akun
 * ini (`defaultAccountId`) — tetap bisa diganti manual di form kalau
 * perlu. */
export function AccountDetailContent() {
  const { account, isLoading } = useAccountDetailPage();

  if (isLoading) return null;

  if (!account) {
    return (
      <p className="text-muted-foreground text-sm">
        Akun ini tidak ditemukan — mungkin sudah dihapus.
      </p>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Riwayat Transaksi</CardTitle>
        <AddTransactionButton />
      </CardHeader>
      <TransactionListContent />
      <TransactionListFooter />
    </Card>
  );
}

function AddTransactionButton() {
  const { openDialog } = useTransactionsDialog();
  return <Button onClick={() => openDialog("create")}>Tambah Transaksi</Button>;
}
