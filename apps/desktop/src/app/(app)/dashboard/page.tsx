import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  CurrentMonthSummaryCard,
  MiniTrendChart,
  RecentTransactionsCard,
  TotalBalanceCard,
} from "@/features/dashboard";

export default function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="Ringkasan kondisi keuangan Anda" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TotalBalanceCard />
        <CurrentMonthSummaryCard />
      </div>

      <MiniTrendChart />

      <RecentTransactionsCard />
    </PageContainer>
  );
}
