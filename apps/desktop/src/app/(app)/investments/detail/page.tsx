"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import {
  InvestmentDetailContent,
  InvestmentDetailHeader,
  InvestmentDetailPageBody,
} from "@/features/investment-detail";

export default function InvestmentDetailPage() {
  return (
    <Suspense fallback={null}>
      <InvestmentDetailPageBody>
        <PageContainer maxWidth="6xl">
          <InvestmentDetailHeader />
          <InvestmentDetailContent />
        </PageContainer>
      </InvestmentDetailPageBody>
    </Suspense>
  );
}
