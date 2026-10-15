"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { ThirdPartyContent, ThirdPartyHeader } from "@/features/third-party";

export default function ThirdPartyPage() {
  return (
    <Suspense fallback={null}>
      <PageContainer maxWidth="6xl">
        <ThirdPartyHeader />
        <ThirdPartyContent />
      </PageContainer>
    </Suspense>
  );
}
