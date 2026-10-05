import { PageContainer } from "@/components/page-container";
import { ReportsHeader, ReportsContent } from "@/features/reports";

export default function ReportsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <ReportsHeader />
      <ReportsContent />
    </PageContainer>
  );
}
