import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CashflowSyncPanel } from "@/features/retailku";

export default function RetailkuCashflowPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Sync Cashflow Retailku"
        description="Sinkronisasi arus kas harian bisnis dari Retailku ke financial-app"
      />
      <Card>
        <CardHeader>
          <CardTitle>Sinkronisasi</CardTitle>
        </CardHeader>
        <CardContent>
          <CashflowSyncPanel />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
