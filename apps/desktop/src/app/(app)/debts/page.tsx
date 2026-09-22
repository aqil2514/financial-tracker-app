import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ContactSummaryCard, DebtsPageProvider, NewDebtDialog } from "@/features/debts";

export default function DebtsPage() {
  return (
    <DebtsPageProvider>
      <PageContainer maxWidth="6xl">
        <PageHeader
          title="Ringkasan Kontak"
          description="Rangkuman piutang dan utang per kontak"
          actions={<NewDebtDialog />}
        />
        <ContactSummaryCard />
      </PageContainer>
    </DebtsPageProvider>
  );
}
