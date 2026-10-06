"use client";

import { PageHeader } from "@/components/page-header";
import { NewInvestmentAccountDialog } from "./new-investment-account-dialog";

export function InvestmentsHeader() {
  return (
    <PageHeader
      title="Investasi"
      description="Pantau instrumen investasi dan nilai pasarnya"
      actions={<NewInvestmentAccountDialog />}
    />
  );
}
