"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/features/accounts";
import { useInvestmentsPage } from "../page/investments-page-context";
import { InvestmentAccountCard } from "./investment-account-card";

export function InvestmentsContent() {
  const { activeTab, setActiveTab } = useInvestmentsPage();
  const { data: accounts, isLoading } = useAccounts();
  const investmentAccounts = (accounts ?? []).filter(
    (account) => account.account_type === "investment"
  );

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
      <TabsList>
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="detail">Detail</TabsTrigger>
      </TabsList>
      <TabsContent value="ringkasan">
        {/* Ringkasan P/L gabungan + chart -- menyusul, lihat
         * docs/todos/plan/account-type-investment.md langkah 4. */}
        <Card>
          <CardHeader>
            <CardTitle>Ringkasan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Segera hadir.</p>
          </CardContent>
        </Card>
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
                Belum ada akun investasi. Buat lewat halaman Akun (Master Data), lalu catat
                pembelian pertama lewat tombol di atas.
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
