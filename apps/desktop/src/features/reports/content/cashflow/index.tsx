"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodPicker } from "@/components/query/period-picker";
import { CashflowColumn } from "./cashflow-column";
import { CashflowSummaryCards } from "./cashflow-summary-cards";

export function CashflowSection() {
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(
    () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: format(from, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    }
  );

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cashflow</CardTitle>
        <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
      </CardHeader>
      <CardContent className="space-y-6">
        {dateRange ? (
          <>
            <CashflowSummaryCards from={dateRange.from} to={dateRange.to} />
            <div className="grid gap-6 md:grid-cols-2">
              <CashflowColumn
                title="Pengeluaran"
                type="expense"
                from={dateRange.from}
                to={dateRange.to}
              />
              <CashflowColumn
                title="Pemasukan"
                type="income"
                from={dateRange.from}
                to={dateRange.to}
              />
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Pilih periode untuk menampilkan data.</p>
        )}
      </CardContent>
    </Card>
  );
}
