"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/features/accounts";
import { BalancePie } from "@/features/accounts/sections/balance-pie-chart/balance-pie";
import { useInvestmentsPage } from "../page/investments-page-context";
import { InvestmentAccountCard } from "./investment-account-card";
import { InvestmentSummaryStats } from "./investment-summary-stats";
import { InvestmentBreakdownList } from "./investment-breakdown-list";
import { useAllInvestmentAccounts } from "@/shared/investments/use-all-investment-accounts";

export function InvestmentsContent() {
  const { activeTab, setActiveTab } = useInvestmentsPage();
  const { data: accounts, isLoading } = useAccounts();
  const investmentAccounts = (accounts ?? []).filter(
    (account) => account.account_type === "investment"
  );
  const { data: marketValues, isLoading: marketValuesLoading, error: marketValuesError } =
    useAllInvestmentAccounts();

  const marketValueByAccountId = new Map((marketValues ?? []).map((row) => [row.account_id, row.current_market_value]));
  const pieData = investmentAccounts.map((account) => ({
    name: account.name,
    balance: marketValueByAccountId.get(account.id) ?? 0,
  }));

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
      <TabsList>
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="detail">Detail</TabsTrigger>
      </TabsList>
      <TabsContent value="ringkasan" className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        ) : investmentAccounts.length === 0 ? (
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
        ) : (
          <>
            <InvestmentSummaryStats investmentAccounts={investmentAccounts} />
            <Card>
              <CardHeader>
                <CardTitle>Distribusi Nilai Pasar</CardTitle>
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
          </>
        )}
      </TabsContent>
      <TabsContent value="detail">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Akun Investasi</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Memuat...</p>
            ) : investmentAccounts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Belum ada akun investasi. Buat lewat tombol "Tambah Akun Investasi" di atas.
              </p>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {investmentAccounts.map((account) => (
                  <InvestmentAccountCard account={account} key={account.id} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
