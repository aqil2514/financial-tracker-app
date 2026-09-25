"use client";

import { PageContainer } from "@/components/page-container";
import { RetailkuSyncCashflowContent } from "@/features/retailku/sync-cashflow/contents";
import { RetailkuSyncCashflowHeader } from "@/features/retailku/sync-cashflow/header";

export default function RetailkuCashflowPage() {
  return (
    <PageContainer maxWidth="6xl">
      <RetailkuSyncCashflowHeader />

      <RetailkuSyncCashflowContent />
    </PageContainer>
  );
}
