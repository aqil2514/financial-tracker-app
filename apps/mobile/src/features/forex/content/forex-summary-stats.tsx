import { View } from "react-native";
import { computePl, formatSignedCurrency } from "@/features/investments/content/pl";
import { StatItem } from "@/features/investments/content/stat-item";
import { formatCurrency } from "@/lib/utils";
import type { ForexAccountSummary } from "@/shared/forex/forex-queries";

export function ForexSummaryStats({ accounts }: { accounts: ForexAccountSummary[] }) {
  const totalModal = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalValue = accounts.reduce((sum, account) => sum + account.currentValue, 0);
  const { pl, percent, toneClass } = computePl(totalValue, totalModal);

  return (
    <View className="flex-row flex-wrap rounded-lg border border-neutral-200 bg-white px-4 py-2">
      <StatItem label="Total Modal" value={formatCurrency(totalModal)} />
      <StatItem label="Total Nilai Terkini" value={formatCurrency(totalValue)} />
      <StatItem label="Total Unrealized P/L" value={formatSignedCurrency(pl)} toneClass={toneClass} />
      <StatItem
        label="P/L (% posisi aktif)"
        value={`${pl >= 0 ? "+" : ""}${percent.toFixed(2)}%`}
        toneClass={toneClass}
      />
    </View>
  );
}
