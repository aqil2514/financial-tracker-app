import { ScrollView } from "react-native";
import { MonthSummary } from "./month-summary";
import { RecentTransactions } from "./recent-transactions";
import { TotalBalance } from "./total-balance";
import { TrendCard } from "./trend-card";

export function DashboardContent() {
  return (
    <ScrollView contentContainerClassName="gap-4 p-4 pb-8">
      <TotalBalance />
      <MonthSummary />
      <TrendCard />
      <RecentTransactions />
    </ScrollView>
  );
}
