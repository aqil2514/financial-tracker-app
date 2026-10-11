"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { useCategoryPeriods } from "@/features/categories/content/period/hooks/use-category-periods";
import { CategoryPeriodPicker, type PeriodOption } from "./category-period-picker";
import { CategoryPeriodSummaryCards } from "./category-period-summary-cards";
import { CategoryPeriodPieChart } from "./category-period-pie-chart";
import { CategoryPeriodLineChart } from "./category-period-line-chart";
import { CategoryPeriodTransactionList } from "./category-period-transaction-list";

type ChartType = "pie" | "line";

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: "pie", label: "Pie Chart" },
  { value: "line", label: "Tren" },
];

export function CategoryPeriodSummarySection() {
  const { data: periods, isLoading, error } = useCategoryPeriods();
  const [selected, setSelected] = useState<PeriodOption | null>(null);
  const [chartType, setChartType] = useState<ChartType>("pie");

  const options: PeriodOption[] = (periods ?? []).map((period) => ({
    value: period.id,
    label: period.name,
  }));

  const selectedPeriod = periods?.find((period) => period.id === selected?.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Periode Kategori</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <QueryState isLoading={isLoading} error={error} />

        <CategoryPeriodPicker options={options} value={selected} onChange={setSelected} />

        {selected && selectedPeriod && (
          <div className="space-y-6">
            <div>
              <p className="font-semibold">{selected.label}</p>
              <p className="text-muted-foreground text-sm">
                {format(new Date(selectedPeriod.start_date), "dd MMM yyyy")} -{" "}
                {format(new Date(selectedPeriod.end_date), "dd MMM yyyy")}
              </p>
            </div>
            <CategoryPeriodSummaryCards periodId={selected.value} />

            <div className="space-y-4">
              <ToggleGroup
                value={[chartType]}
                onValueChange={(values: string[]) => {
                  if (values.length > 0) setChartType(values[values.length - 1] as ChartType);
                }}
              >
                {CHART_TYPE_OPTIONS.map((option) => (
                  <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {chartType === "pie" ? (
                <CategoryPeriodPieChart periodId={selected.value} />
              ) : (
                <CategoryPeriodLineChart periodId={selected.value} />
              )}
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">Daftar Transaksi</h3>
                <p className="text-muted-foreground text-sm">Dikelompokkan per tanggal.</p>
              </div>
              <Separator />
              <CategoryPeriodTransactionList periodId={selected.value} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
