"use client";

import { TransactionsDialogs } from "@/features/transactions";
import { useAccountDetailPage } from "./account-detail-page-context";

/** Dialog transaksi (create/edit/detail/delete-confirm) di-reuse dari
 * `features/transactions`, dipasang di level `page.tsx` (sejajar dengan
 * `AccountDetailContent`, bukan di dalamnya — lihat page-layout.md) supaya
 * konsisten dengan pola `TransactionsDialogs` di halaman Transaksi.
 * `defaultAccountId` diambil dari context supaya form create otomatis
 * ter-scope ke akun yang sedang dilihat. */
export function AccountDetailDialogs() {
  const { accountId } = useAccountDetailPage();
  return <TransactionsDialogs defaultAccountId={accountId} />;
}
