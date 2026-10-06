"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format-currency";
import { AccountEditDialog } from "@/features/accounts";
import { NewInvestmentPurchaseDialog } from "@/shared/investments/new-purchase-form/new-investment-purchase-dialog";
import { useInvestmentDetailPage } from "../page/investment-detail-page-context";
import { InvestmentPlStats } from "./investment-pl-stats";

export function InvestmentDetailHeader() {
  const router = useRouter();
  const { account, isLoading } = useInvestmentDetailPage();

  if (isLoading) {
    return <PageHeader title="Memuat akun..." actions={<BackButton onClick={() => router.back()} />} />;
  }

  if (!account) {
    return (
      <PageHeader title="Akun tidak ditemukan" actions={<BackButton onClick={() => router.back()} />} />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={account.name}
        description={`Modal: ${formatCurrency(account.balance, "IDR")}`}
        actions={
          <div className="flex items-center gap-2">
            {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
            {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
            <NewInvestmentPurchaseDialog investmentAccountId={account.id} />
            <AccountEditDialog account={account} />
            <BackButton onClick={() => router.back()} />
          </div>
        }
      />
      <InvestmentPlStats accountId={account.id} balance={account.balance} />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <ArrowLeft className="size-4" />
      Kembali
    </Button>
  );
}
