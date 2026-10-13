"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { InvestmentsContent, InvestmentsHeader } from "@/features/investments";

export default function InvestmentsPage() {
  return (
    <Suspense fallback={null}>
      <PageContainer maxWidth="6xl">
        <InvestmentsHeader />
        <InvestmentsContent />
      </PageContainer>
    </Suspense>
  );
}
