"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { AccountsContent, AccountsHeader } from "@/features/accounts";

export default function AccountsPage() {
  return (
    <Suspense fallback={null}>
      <PageContainer maxWidth="6xl">
        <AccountsHeader />
        <AccountsContent />
      </PageContainer>
    </Suspense>
  );
}
