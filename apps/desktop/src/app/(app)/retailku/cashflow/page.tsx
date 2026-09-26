"use client";

import { PageContainer } from "@/components/page-container";
import { RetailkuSyncCashflowContent, RetailkuSyncCashflowHeader } from "@/features/retailku/sync-cashflow";

export default function RetailkuCashflowPage() {
  return (
    <PageContainer maxWidth="6xl">
      <RetailkuSyncCashflowHeader />

      <RetailkuSyncCashflowContent />
    </PageContainer>
  );
}
