import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactSummaryTable } from "@/features/debts";

export default function DebtsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Ringkasan Kontak"
        description="Rangkuman piutang dan utang per kontak"
      />
      <Card>
        <CardHeader>
          <CardTitle>Per Kontak</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactSummaryTable />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
