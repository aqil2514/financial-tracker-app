import { PageContainer } from "@/components/page-container";
import { DashboardContent, DashboardHeader } from "@/features/dashboard";

export default function DashboardPage() {
  return (
    <PageContainer>
      <DashboardHeader />
      <DashboardContent />
    </PageContainer>
  );
}
