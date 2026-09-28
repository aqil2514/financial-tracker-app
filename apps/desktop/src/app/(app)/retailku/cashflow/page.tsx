"use client";

import { PageContainer } from "@/components/page-container";
import {
  RetailkuCashflowSummaryContent,
  RetailkuCashflowSummaryHeader,
  RetailkuSyncCashflowSummaryProvider,
} from "@/features/retailku/summary";

export default function RetailkuCashflowPage() {
  return (
    <RetailkuSyncCashflowSummaryProvider>
      <PageContainer maxWidth="6xl">
        <RetailkuCashflowSummaryHeader />
        <RetailkuCashflowSummaryContent />
      </PageContainer>
    </RetailkuSyncCashflowSummaryProvider>
  );
}
