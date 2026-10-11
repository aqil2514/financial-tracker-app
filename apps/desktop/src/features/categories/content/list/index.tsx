import { Suspense } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryList } from "./list";
import { CategoryFormDialog } from "./form";

export function CategoryListSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Kategori</CardTitle>
        <CardAction>
          <CategoryFormDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={null}>
          <CategoryList />
        </Suspense>
      </CardContent>
    </Card>
  );
}
