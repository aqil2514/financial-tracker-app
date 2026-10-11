import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPeriodDialogProvider, CreateCategoryPeriodDialog } from "./dialogs";
import { CategoryPeriodList } from "./list";

export function CategoryPeriodSection() {
  return (
    <CategoryPeriodDialogProvider>
      <Card>
        <CardHeader>
          <CardTitle>Periode Kategori</CardTitle>
          <CardAction>
            <CreateCategoryPeriodDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <CategoryPeriodList />
        </CardContent>
      </Card>
    </CategoryPeriodDialogProvider>
  );
}
