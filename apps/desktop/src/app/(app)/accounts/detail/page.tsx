"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import {
  AccountDetailContent,
  AccountDetailHeader,
  AccountDetailPageProvider,
} from "@/features/account-detail";

export default function AccountDetailPage() {
  return (
    <Suspense fallback={null}>
      <AccountDetailPageBody />
    </Suspense>
  );
}

function AccountDetailPageBody() {
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
    <AccountDetailPageProvider accountId={accountId}>
      <PageContainer maxWidth="6xl">
        <AccountDetailHeader />
        <AccountDetailContent />
      </PageContainer>
    </AccountDetailPageProvider>
  );
}
