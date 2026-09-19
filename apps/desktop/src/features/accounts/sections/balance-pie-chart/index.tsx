"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountBalances } from "@/features/reports";
import { useAccountGroupBalances } from "./use-account-group-balances";
import { BalancePie } from "./balance-pie";

export function AccountBalancePieChart() {
  const accountBalances = useAccountBalances();
  const groupBalances = useAccountGroupBalances();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Saldo</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account">Per Akun</TabsTrigger>
            <TabsTrigger value="group">Per Grup Akun</TabsTrigger>
          </TabsList>
          <TabsContent value="account">
            <BalancePie
              data={accountBalances.data}
              isLoading={accountBalances.isLoading}
              error={accountBalances.error as Error | null}
              emptyMessage="Belum ada akun."
            />
          </TabsContent>
          <TabsContent value="group">
            <BalancePie
              data={groupBalances.data}
              isLoading={groupBalances.isLoading}
              error={groupBalances.error as Error | null}
              emptyMessage="Belum ada grup akun."
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
