"use client";

import Link from "next/link";

import { QueryState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentTransactions } from "./use-recent-transactions";
import { ListContent } from "./list-content";

export function RecentTransactionsCard() {
  const { isLoading, error } = useRecentTransactions();

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Transaksi Terbaru</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/transactions" />}
        >
          Lihat semua
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <QueryState isLoading={isLoading} error={error} />
        <ListContent />
      </CardContent>
    </Card>
  );
}
