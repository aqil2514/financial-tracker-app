import {
  CurrentMonthSummaryCard,
  MiniTrendChart,
  RecentTransactionsCard,
  TotalBalanceCard,
} from "@/features/dashboard";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <TotalBalanceCard />
        <CurrentMonthSummaryCard />
      </div>

      <MiniTrendChart />

      <RecentTransactionsCard />
    </div>
  );
}
