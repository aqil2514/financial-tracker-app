import { CurrentMonthSummaryCard } from "./current-month-summary";
import { MiniTrendChart } from "./mini-trend-chart";
import { RecentTransactionsCard } from "./recent-transactions";
import { TotalBalanceCard } from "./total-balance";

export function DashboardContent() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TotalBalanceCard />
        <CurrentMonthSummaryCard />
      </div>

      <MiniTrendChart />

      <RecentTransactionsCard />
    </>
  );
}
