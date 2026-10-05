"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodPicker } from "@/components/query/period-picker";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CashflowColumn } from "./cashflow-column";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import { CashflowTransactionsDialog, type CashflowDrillDownTarget } from "./cashflow-transactions-dialog";
import type { CashflowGroupBy } from "./use-cashflow-breakdown";

const GROUP_BY_OPTIONS: { value: CashflowGroupBy; label: string }[] = [
  { value: "account_group", label: "Grup Akun" },
  { value: "parent_category", label: "Kategori Induk" },
];

export function CashflowSection() {
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(
    () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: format(from, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    }
  );
  const [groupBy, setGroupBy] = useState<CashflowGroupBy>("account_group");
  const [drillDown, setDrillDown] = useState<CashflowDrillDownTarget | null>(null);

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

            <ToggleGroup
              value={[groupBy]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) setGroupBy(values[values.length - 1] as CashflowGroupBy);
              }}
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="grid gap-6 md:grid-cols-2">
              <CashflowColumn
                title="Pengeluaran"
                type="expense"
                from={dateRange.from}
                to={dateRange.to}
                groupBy={groupBy}
                onRowClick={(row) =>
                  setDrillDown({ type: "expense", groupBy, groupKey: row.groupKey, label: row.label })
                }
              />
              <CashflowColumn
                title="Pemasukan"
                type="income"
                from={dateRange.from}
                to={dateRange.to}
                groupBy={groupBy}
                onRowClick={(row) =>
                  setDrillDown({ type: "income", groupBy, groupKey: row.groupKey, label: row.label })
                }
              />
            </div>

            <CashflowTransactionsDialog
              target={drillDown}
              from={dateRange.from}
              to={dateRange.to}
              onOpenChange={(open) => !open && setDrillDown(null)}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Pilih periode untuk menampilkan data.</p>
        )}
      </CardContent>
    </Card>
  );
}
