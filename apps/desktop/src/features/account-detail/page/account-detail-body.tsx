"use client";

import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import { AccountDetailPageProvider } from "./account-detail-page-context";

/**
 * Baca `accountId` dari query param `?id=` (pola sama seperti
 * `DeepLinkEditDialog` di `features/transactions/page/`) dan bungkus
 * `children` dengan `AccountDetailPageProvider` kalau valid — `page.tsx`
 * sendiri tidak boleh baca `useSearchParams()`/logic apa pun (lihat
 * page-layout.md), jadi logic itu tinggal di sini.
 */
export function AccountDetailPageBody({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const accountId = Number(searchParams.get("id"));

  if (!accountId) {
    return (
      <PageContainer maxWidth="6xl">
        <p className="text-muted-foreground text-sm">Akun tidak ditemukan.</p>
      </PageContainer>
    );
  }

  return (
    <AccountDetailPageProvider accountId={accountId}>{children}</AccountDetailPageProvider>
  );
}
