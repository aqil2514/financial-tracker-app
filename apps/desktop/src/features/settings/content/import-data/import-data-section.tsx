import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportMoneyManagerDialog } from "./import-money-manager-dialog";

export function ImportDataSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Import data akun, kategori, dan transaksi dari file backup Money Manager (.mmbak). Seluruh
          data yang ada saat ini akan diganti.
        </p>
        <ImportMoneyManagerDialog />
      </CardContent>
    </Card>
  );
}
