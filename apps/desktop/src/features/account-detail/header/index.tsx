"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format-currency";
import { useAccountDetailPage } from "../page/account-detail-page-context";

export function AccountDetailHeader() {
  const router = useRouter();
  const { account, isLoading } = useAccountDetailPage();

  if (isLoading) {
    return (
      <PageHeader
        title="Memuat akun..."
        actions={<BackButton onClick={() => router.back()} />}
      />
    );
  }

  if (!account) {
    return (
      <PageHeader
        title="Akun tidak ditemukan"
        actions={<BackButton onClick={() => router.back()} />}
      />
    );
  }

  return (
    <PageHeader
      title={account.name}
      description={formatCurrency(account.balance, "IDR")}
      actions={
        <div className="flex items-center gap-2">
          {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
          {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
          <BackButton onClick={() => router.back()} />
        </div>
      }
    />
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
