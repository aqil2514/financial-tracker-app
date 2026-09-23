"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import {
  AccountDetailContent,
  AccountDetailDialogs,
  AccountDetailHeader,
  AccountDetailPageBody,
  AccountDetailTransactionListProvider,
} from "@/features/account-detail";
import { TransactionsDialogProvider, TransactionsPageProvider } from "@/features/transactions";

export default function AccountDetailPage() {
  return (
    <TransactionsPageProvider>
      <TransactionsDialogProvider>
        <Suspense fallback={null}>
          <AccountDetailPageBody>
            <AccountDetailTransactionListProvider>
              <PageContainer maxWidth="6xl">
                <AccountDetailHeader />
                <AccountDetailContent />
              </PageContainer>

              <AccountDetailDialogs />
            </AccountDetailTransactionListProvider>
          </AccountDetailPageBody>
        </Suspense>
      </TransactionsDialogProvider>
    </TransactionsPageProvider>
  );
}
