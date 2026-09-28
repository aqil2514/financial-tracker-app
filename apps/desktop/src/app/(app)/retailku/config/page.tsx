"use client";

import { PageContainer } from "@/components/page-container";
import {
  RetailkuCashflowConfigContent,
  RetailkuCashflowConfigHeader,
  RetailkuSyncCashflowConfigProvider,
} from "@/features/retailku/config";

export default function RetailkuConfigPage() {
  return (
    <RetailkuSyncCashflowConfigProvider>
      <PageContainer maxWidth="6xl">
        <RetailkuCashflowConfigHeader />
        <RetailkuCashflowConfigContent />
      </PageContainer>
    </RetailkuSyncCashflowConfigProvider>
  );
}
