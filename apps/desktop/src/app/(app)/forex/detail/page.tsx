"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { ForexDetailContent, ForexDetailHeader, ForexDetailPageBody } from "@/features/forex-detail";

export default function ForexDetailPage() {
  return (
    <Suspense fallback={null}>
      <ForexDetailPageBody>
        <PageContainer maxWidth="6xl">
          <ForexDetailHeader />
          <ForexDetailContent />
        </PageContainer>
      </ForexDetailPageBody>
    </Suspense>
  );
}
