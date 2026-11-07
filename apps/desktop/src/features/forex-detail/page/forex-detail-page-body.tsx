"use client";

import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/page-container";
import { ForexDetailPageProvider } from "./forex-detail-page-context";

// Baca accountId dari query param ?id=, pola sama InvestmentDetailPageBody.
export function ForexDetailPageBody({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const accountId = searchParams.get("id");

  if (!accountId) {
    return (
      <PageContainer maxWidth="6xl">
        <p className="text-muted-foreground text-sm">Akun valas tidak ditemukan.</p>
      </PageContainer>
    );
  }

  return <ForexDetailPageProvider accountId={accountId}>{children}</ForexDetailPageProvider>;
}
