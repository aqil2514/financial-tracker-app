"use client";

import { ArrowLeft, InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format-currency";
import { AccountEditDialog } from "@/features/accounts";
import { NewInvestmentPurchaseDialog } from "@/shared/investments/new-purchase-form/new-investment-purchase-dialog";
import { SellInvestmentDialog } from "@/shared/investments/sell-investment-form/sell-investment-dialog";
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
      <div className="space-y-1">
        <PageHeader
          title={account.name}
          actions={
            <div className="flex items-center gap-2">
              {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
              {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
              <NewInvestmentPurchaseDialog investmentAccountId={account.id} />
              <SellInvestmentDialog investmentAccountId={account.id} />
              <AccountEditDialog account={account} />
              <BackButton onClick={() => router.back()} />
            </div>
          }
        />
        <div className="flex items-center gap-1">
          <p className="text-muted-foreground text-sm">Modal: {formatCurrency(account.balance, "IDR")}</p>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Penjelasan modal"
                />
              }
            >
              <InfoIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              Total uang yang ditanamkan lewat transfer kas ke akun ini (saldo akun, accounts.balance) —
              BUKAN nilai pasar terkini. Sama seperti saldo akun tipe lain, dihitung dari saldo awal +
              transfer masuk/keluar, TIDAK terpengaruh update nilai pasar.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
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
