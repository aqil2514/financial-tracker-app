import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export default function ReceivablesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Piutang" description="Daftar piutang — uang yang dipinjamkan ke orang lain" />
      <p className="text-muted-foreground text-sm">Segera hadir.</p>
    </PageContainer>
  );
}
