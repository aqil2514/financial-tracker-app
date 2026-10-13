"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAccounts } from "@/features/accounts";
import { BalancePie } from "@/features/accounts/contents/summary/balance-pie";
import { useAllInvestmentAccounts } from "@/shared/investments/use-all-investment-accounts";
import { useInvestmentAccountLabels } from "@/shared/investments/use-investment-account-labels";
import { aggregateInvestmentByLabel } from "@/shared/investments/aggregate-by-label";
import { InvestmentSummaryStats } from "./investment-summary-stats";
import { InvestmentBreakdownList } from "./investment-breakdown-list";
import { InvestmentLabelBreakdown } from "./investment-label-breakdown";

type PieMode = "account" | "label";

export function InvestmentsSummarySection() {
  const [pieMode, setPieMode] = useState<PieMode>("account");
  const { data: accounts, isLoading } = useAccounts();
  const investmentAccounts = (accounts ?? []).filter(
    (account) => account.account_type === "investment"
  );
  const { data: marketValues, isLoading: marketValuesLoading, error: marketValuesError } =
    useAllInvestmentAccounts();
  const { data: accountLabels } = useInvestmentAccountLabels();

  const marketValueByAccountId = new Map((marketValues ?? []).map((row) => [row.account_id, row.current_market_value]));

  const labelBreakdown = aggregateInvestmentByLabel(
    investmentAccounts,
    marketValueByAccountId,
    accountLabels ?? []
  );

  // Mode "account": pie per akun individual (perilaku lama, tidak
  // berubah). Mode "label": pie per jenis instrumen -- akun dgn >1 label
  // ikut "berkontribusi" nilai penuh ke SETIAP labelnya (overlap sengaja,
  // lihat aggregate-by-label.ts), jadi total pie mode ini BISA > total
  // modal sungguhan kalau ada akun multi-label.
  const pieData =
    pieMode === "account"
      ? investmentAccounts.map((account) => ({
          name: account.name,
          balance: marketValueByAccountId.get(account.id) ?? 0,
        }))
      : labelBreakdown.map((row) => ({ name: row.label, balance: row.totalMarketValue }));

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Memuat...</p>;
  }

  if (investmentAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Belum ada akun investasi. Buat lewat tombol "Tambah Akun Investasi" di atas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <InvestmentSummaryStats investmentAccounts={investmentAccounts} />
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>Distribusi Nilai Pasar</CardTitle>
          <ToggleGroup
            value={[pieMode]}
            onValueChange={(values: string[]) => {
              if (values.length > 0) setPieMode(values[values.length - 1] as PieMode);
            }}
          >
            <ToggleGroupItem value="account">Per Akun</ToggleGroupItem>
            <ToggleGroupItem value="label">Per Jenis</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <BalancePie
            data={pieData}
            isLoading={marketValuesLoading}
            error={marketValuesError as Error | null}
            emptyMessage="Belum ada nilai pasar tercatat."
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Per Akun</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestmentBreakdownList investmentAccounts={investmentAccounts} />
        </CardContent>
      </Card>
      {labelBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Per Jenis Instrumen</CardTitle>
          </CardHeader>
          <CardContent>
            <InvestmentLabelBreakdown rows={labelBreakdown} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
