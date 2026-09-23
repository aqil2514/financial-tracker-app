"use client";

import { TransactionListProvider } from "@/features/transactions";
import { useAccountDetailPage } from "./account-detail-page-context";

/**
 * Bungkus `TransactionListProvider` (context filter/sort/pagination list
 * transaksi, dari `features/transactions`) dengan `accountId` dari
 * context — dipasang di level `page/` account-detail (bukan di dalam
 * `content/`) supaya `header/` (filter+sort) dan `content/` (list) bisa
 * sama-sama mengonsumsi `useList()` yang sama, konsisten dengan aturan
 * "context yang dibagi lintas section naik ke `page/`" di page-layout.md.
 */
export function AccountDetailTransactionListProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { accountId } = useAccountDetailPage();
  return (
    <TransactionListProvider accountId={accountId}>{children}</TransactionListProvider>
  );
}
