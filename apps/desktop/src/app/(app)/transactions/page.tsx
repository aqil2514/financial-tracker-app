"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  DeepLinkEditDialog,
  TransactionCalendarPanel,
  TransactionFormDialog,
  TransactionList,
  TransactionsPageProvider,
} from "@/features/transactions";

export default function TransactionsPage() {
  return (
    <TransactionsPageProvider>
      <PageContainer maxWidth="6xl">
        <PageHeader
          title="Transaksi"
          description="Kelola seluruh transaksi keuangan Anda"
          actions={<TransactionFormDialog />}
        />

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
          <TransactionList />
          <TransactionCalendarPanel />
        </div>
      </PageContainer>

      <Suspense fallback={null}>
        <DeepLinkEditDialog />
      </Suspense>
    </TransactionsPageProvider>
  );
}
