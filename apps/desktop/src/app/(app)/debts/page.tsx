import { PageContainer } from "@/components/page-container";
import {
  DebtsSummaryContent,
  DebtsSummaryHeader,
  DebtsSummaryPageProvider,
} from "@/features/debts-summary";

export default function DebtsPage() {
  return (
    <DebtsSummaryPageProvider>
      <PageContainer maxWidth="6xl">
        <DebtsSummaryHeader />
        <DebtsSummaryContent />
      </PageContainer>
    </DebtsSummaryPageProvider>
  );
}
