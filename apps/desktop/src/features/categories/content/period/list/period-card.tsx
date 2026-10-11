"use client";

import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CategoryPeriodWithCategories } from "../hooks/use-category-periods";
import { useCategoryPeriodDialog } from "../dialogs/context";

export function PeriodCard({ period }: { period: CategoryPeriodWithCategories }) {
  const { openDialog } = useCategoryPeriodDialog();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{period.name}</p>
          <p className="text-muted-foreground text-sm">
            {format(new Date(period.start_date), "dd MMM yyyy")} -{" "}
            {format(new Date(period.end_date), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {period.is_ongoing === 1 ? (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Berlangsung
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Selesai
            </Badge>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => openDialog("edit", period.id)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => openDialog("delete", period.id)}>
            <Trash2 className="text-destructive size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-xs">{period.category_names}</p>
      </CardContent>
    </Card>
  );
}
