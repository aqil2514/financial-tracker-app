"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format-currency";
import { NewForexPurchaseDialog } from "@/shared/forex/new-purchase/new-forex-purchase-dialog";
import { SellForexDialog } from "@/shared/forex/sell/sell-forex-dialog";
import { useForexAccount } from "@/shared/forex/use-forex-account";
import { useForexDetailPage } from "../page/forex-detail-page-context";
import { AccountEditDialog } from "./account-edit-dialog";
import { ForexStats } from "./forex-stats";

export function ForexDetailHeader() {
  const router = useRouter();
  const { account, isLoading } = useForexDetailPage();
  const { data: forexAccount } = useForexAccount(account?.id);

  if (isLoading) {
    return <PageHeader title="Memuat akun..." actions={<BackButton onClick={() => router.back()} />} />;
  }

  if (!account) {
    return <PageHeader title="Akun tidak ditemukan" actions={<BackButton onClick={() => router.back()} />} />;
  }

  const currency = forexAccount?.currency ?? "";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <PageHeader
          title={account.name}
          actions={
            <div className="flex items-center gap-2">
              {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
              {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
              {forexAccount && (
                <>
                  <NewForexPurchaseDialog forexAccountId={account.id} currency={currency} />
                  <SellForexDialog forexAccountId={account.id} currency={currency} />
                </>
              )}
              <AccountEditDialog account={account} />
              <BackButton onClick={() => router.back()} />
            </div>
          }
        />
        <p className="text-muted-foreground text-sm">
          {forexAccount ? `${forexAccount.country} · ` : ""}Modal: {formatCurrency(account.balance, "IDR")}
        </p>
      </div>
      <ForexStats accountId={account.id} balance={account.balance} />
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
