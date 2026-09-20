import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtListTable } from "@/features/debts";

export default function ReceivablesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Piutang" description="Daftar piutang — uang yang dipinjamkan ke orang lain" />
      <Card>
        <CardHeader>
          <CardTitle>Semua Piutang</CardTitle>
        </CardHeader>
        <CardContent>
          <DebtListTable type="receivable" />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
