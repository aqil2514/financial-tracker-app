import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export default function DebtsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Ringkasan Kontak"
        description="Rangkuman piutang dan utang per kontak"
      />
      <p className="text-muted-foreground text-sm">Segera hadir.</p>
    </PageContainer>
  );
}
