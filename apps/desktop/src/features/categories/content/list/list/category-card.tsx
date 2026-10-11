"use client";

import type { Category } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { CategoryEditDialog } from "../form/category-edit-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";
import { CategoryStatusDot } from "./category-status-dot";

export function CategoryCard({
  category,
  parentName,
}: {
  category: Category;
  parentName: string | null;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <CategoryStatusDot category={category} />
          <p className="font-semibold">{category.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <CategoryEditDialog category={category} />
          <DeleteCategoryDialog category={category} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <Badge variant={category.type === "income" ? "default" : "secondary"}>
          {category.type === "income" ? "Pemasukan" : "Pengeluaran"}
        </Badge>
        {parentName && (
          <p className="text-muted-foreground text-xs">Sub-kategori dari {parentName}</p>
        )}
      </CardContent>
    </Card>
  );
}
