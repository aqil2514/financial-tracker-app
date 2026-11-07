"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { ForexContent, ForexHeader } from "@/features/forex";

export default function ForexPage() {
  return (
    <Suspense fallback={null}>
      <PageContainer maxWidth="6xl">
        <ForexHeader />
        <ForexContent />
      </PageContainer>
    </Suspense>
  );
}
