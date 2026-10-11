"use client";

import { useState } from "react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { useCategoryPeriods } from "@/features/categories/content/period/hooks/use-category-periods";
import { CategoryPeriodPicker, type PeriodOption } from "./category-period-picker";
import { CategoryPeriodSummaryCards } from "./category-period-summary-cards";
import { CategoryPeriodPieChart } from "./category-period-pie-chart";
import { CategoryPeriodTransactionList } from "./category-period-transaction-list";

export function CategoryPeriodSummarySection() {
  const { data: periods, isLoading, error } = useCategoryPeriods();
  const [selected, setSelected] = useState<PeriodOption | null>(null);

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
            <CategoryPeriodPieChart periodId={selected.value} />
            <CategoryPeriodTransactionList periodId={selected.value} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
