"use client";

import { PageContainer } from "@/components/page-container";
import {
  RetailkuCashflowMappingContent,
  RetailkuCashflowMappingHeader,
  RetailkuSyncCashflowMappingProvider,
} from "@/features/retailku/mapping";

export default function RetailkuMappingPage() {
  return (
    <RetailkuSyncCashflowMappingProvider>
      <PageContainer maxWidth="6xl">
        <RetailkuCashflowMappingHeader />
        <RetailkuCashflowMappingContent />
      </PageContainer>
    </RetailkuSyncCashflowMappingProvider>
  );
}
