import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LabelList, LabelFormDialog } from "@/features/labels";

export default function LabelsPage() {
  return (
    <PageContainer>
      <PageHeader title="Label" description="Kelola daftar label untuk transaksi, kategori, dan akun" />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Label</CardTitle>
          <CardAction>
            <LabelFormDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <LabelList />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
