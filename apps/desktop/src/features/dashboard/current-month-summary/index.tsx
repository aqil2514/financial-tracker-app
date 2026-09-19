"use client";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentMonthSummary } from "./use-current-month-summary";
import { SummaryStats } from "./summary-stats";

export function CurrentMonthSummaryCard() {
  const { isLoading, error } = useCurrentMonthSummary();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulan Ini</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isLoading={isLoading} error={error} />
        <SummaryStats />
      </CardContent>
    </Card>
  );
}
