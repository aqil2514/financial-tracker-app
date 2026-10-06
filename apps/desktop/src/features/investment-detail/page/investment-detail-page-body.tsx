"use client";

import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import { InvestmentDetailPageProvider } from "./investment-detail-page-context";

/** Baca `accountId` dari query param `?id=` — pola PERSIS
 * `AccountDetailPageBody` (features/account-detail/page/). */
export function InvestmentDetailPageBody({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id");

  if (!accountId) {
    return (
      <PageContainer maxWidth="6xl">
        <p className="text-muted-foreground text-sm">Akun investasi tidak ditemukan.</p>
      </PageContainer>
    );
  }

  return (
    <InvestmentDetailPageProvider accountId={accountId}>{children}</InvestmentDetailPageProvider>
  );
}
