import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPeriodDialogProvider, CreateCategoryPeriodDialog } from "./dialogs";

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
          <p className="text-muted-foreground text-sm">Segera hadir.</p>
        </CardContent>
      </Card>
    </CategoryPeriodDialogProvider>
  );
}
