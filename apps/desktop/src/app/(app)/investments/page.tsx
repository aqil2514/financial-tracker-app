"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { InvestmentsContent, InvestmentsHeader, InvestmentsPageProvider } from "@/features/investments";

export default function InvestmentsPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentsPageProvider>
        <PageContainer maxWidth="6xl">
          <InvestmentsHeader />
          <InvestmentsContent />
        </PageContainer>
      </InvestmentsPageProvider>
    </Suspense>
  );
}
