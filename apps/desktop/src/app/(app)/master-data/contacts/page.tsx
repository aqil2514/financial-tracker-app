import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";

export default function ContactsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader title="Nama Pihak" description="Kelola daftar kontak/pihak terkait" />
      <p className="text-muted-foreground text-sm">Segera hadir.</p>
    </PageContainer>
  );
}
