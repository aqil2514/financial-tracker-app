"use client";

import { QueryState } from "@/components/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMonthlySummary } from "@/features/reports";
import { ChartContent } from "./chart-content";

const MONTHS = 6;

export function MiniTrendChart() {
  const { isLoading, error } = useMonthlySummary(MONTHS);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tren 6 Bulan Terakhir</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <QueryState isLoading={isLoading} error={error} />
        <ChartContent />
      </CardContent>
    </Card>
  );
}
