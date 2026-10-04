"use client";

import { Suspense } from "react";

import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { AccountFormDialog, AccountList } from "@/features/accounts";

export default function AccountsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Akun"
        description="Kelola akun dan saldo keuangan Anda"
        actions={<AccountFormDialog />}
      />
      <Suspense fallback={null}>
        <AccountList />
      </Suspense>
    </PageContainer>
  );
}
