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
import { RetailkuDialogProvider, RetailkuPickerDialog } from "@/shared/retailku";

export default function TransactionsPage() {
  return (
    <TransactionsPageProvider>
      <TransactionsDialogProvider>
        <RetailkuDialogProvider>
          <PageContainer maxWidth="6xl">
            <TransactionsHeader />
            <TransactionsContent />
          </PageContainer>

          <TransactionsDialogs />
          <RetailkuPickerDialog />

          <Suspense fallback={null}>
            <DeepLinkEditDialog />
          </Suspense>
        </RetailkuDialogProvider>
      </TransactionsDialogProvider>
    </TransactionsPageProvider>
  );
}
