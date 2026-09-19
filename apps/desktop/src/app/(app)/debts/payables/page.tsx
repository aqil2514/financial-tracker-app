import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export default function PayablesPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Utang" description="Daftar utang — uang yang dipinjam dari orang lain" />
      <p className="text-muted-foreground text-sm">Segera hadir.</p>
    </PageContainer>
  );
}
