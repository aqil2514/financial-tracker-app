"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import {
  DeepLinkEditDialog,
  TransactionsContent,
  TransactionsDialogProvider,
  TransactionsDialogs,
  TransactionsHeader,
  TransactionsPageProvider,
} from "@/features/transactions";

export default function TransactionsPage() {
  return (
    <TransactionsPageProvider>
      <TransactionsDialogProvider>
        <PageContainer maxWidth="6xl">
          <TransactionsHeader />
          <TransactionsContent />
        </PageContainer>

        <TransactionsDialogs />

        <Suspense fallback={null}>
          <DeepLinkEditDialog />
        </Suspense>
      </TransactionsDialogProvider>
    </TransactionsPageProvider>
  );
}
