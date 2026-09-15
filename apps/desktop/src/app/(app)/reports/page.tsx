import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Laporan</h1>

      <Card>
        <CardHeader>
          <CardTitle>Laporan Bulanan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Belum ada laporan. Menyusul.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
