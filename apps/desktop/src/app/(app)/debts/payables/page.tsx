import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DebtListTable, NewDebtDialog } from "@/features/debts";

export default function PayablesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Utang"
        description="Daftar utang — uang yang dipinjam dari orang lain"
        actions={<NewDebtDialog />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Semua Utang</CardTitle>
        </CardHeader>
        <CardContent>
          <DebtListTable type="payable" />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
