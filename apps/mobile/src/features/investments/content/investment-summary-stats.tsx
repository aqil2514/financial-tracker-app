import { View } from "react-native";
import { formatCurrency } from "@/lib/utils";
import type { MockInvestmentAccount } from "../mock-data";
import { computePl, formatSignedCurrency } from "./pl";
import { StatItem } from "./stat-item";

export function InvestmentSummaryStats({ accounts }: { accounts: MockInvestmentAccount[] }) {
  const totalModal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalMarketValue = accounts.reduce((sum, account) => sum + account.currentMarketValue, 0);
  const { pl, percent, toneClass } = computePl(totalMarketValue, totalModal);

  return (
    <View className="flex-row flex-wrap rounded-lg border border-neutral-200 bg-white px-4 py-2">
      <StatItem label="Total Modal" value={formatCurrency(totalModal)} />
      <StatItem label="Total Nilai Pasar" value={formatCurrency(totalMarketValue)} />
      <StatItem label="Total Unrealized P/L" value={formatSignedCurrency(pl)} toneClass={toneClass} />
      <StatItem
        label="P/L (% posisi aktif)"
        value={`${pl >= 0 ? "+" : ""}${percent.toFixed(2)}%`}
        toneClass={toneClass}
      />
    </View>
  );
}
