"use client";

import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/format-currency";
import { PeriodPicker } from "@/components/query/period-picker";
import { TransactionListFilter, TransactionListSort, useTransactionList } from "@/features/transactions";
import { useAccountDetailPage } from "../page/account-detail-page-context";
import { AccountSummaryStats } from "./account-summary-stats";

export function AccountDetailHeader() {
  const router = useRouter();
  const { account, isLoading } = useAccountDetailPage();
  const { dateRange, setDateRange } = useTransactionList().filter;

  // `dateRange` di context bentuknya string "yyyy-MM-dd" (siap pakai SQL
  // BETWEEN, lihat build-where-conditions.ts) — PeriodPicker sendiri
  // bekerja dengan `Date`, jadi dikonversi di titik masuk/keluar sini,
  // bukan mengubah bentuk context supaya query tetap terima string siap
  // pakai tanpa parsing ulang.
  const periodValue = useMemo<DateRange | undefined>(
    () =>
      dateRange
        ? { from: new Date(`${dateRange.from}T00:00`), to: new Date(`${dateRange.to}T00:00`) }
        : undefined,
    [dateRange]
  );

  function handlePeriodChange(range: DateRange | undefined) {
    if (!range?.from || !range.to) {
      setDateRange(undefined);
      return;
    }
    setDateRange({ from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") });
  }

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
    <div className="space-y-4">
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
      <div className="flex flex-wrap items-center gap-2">
        <TransactionListSort />
        <TransactionListFilter excludeKeys={["account_id"]} />
        <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
      </div>
      <AccountSummaryStats accountId={account.id} balance={account.balance} />
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
