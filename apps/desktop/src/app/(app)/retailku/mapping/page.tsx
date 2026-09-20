import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountMappingList } from "@/features/retailku";

export default function RetailkuMappingPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Mapping Akun Retailku"
        description="Hubungkan akun kas/bank Retailku ke akun lokal financial-app"
      />
      <Card>
        <CardHeader>
          <CardTitle>Akun Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountMappingList />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
