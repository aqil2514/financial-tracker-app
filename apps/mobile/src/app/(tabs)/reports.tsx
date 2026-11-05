import { useState } from "react";
import { ScrollView, View } from "react-native";
import { MonthNavigator } from "@/components/month-navigator";
import { PageHeader } from "@/components/page-header";
import { TabSwitcher } from "@/components/tab-switcher";
import { AccountTypeSection } from "@/features/reports/account-type";
import { BalanceTrendSection } from "@/features/reports/balance-trend";
import { CashflowSection } from "@/features/reports/cashflow";
import { CategoryPeriodSection } from "@/features/reports/category-period";
import { currentMonth } from "@/lib/utils";

type ReportTab = "cashflow" | "account-type" | "balance-trend" | "category-period";

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: "cashflow", label: "Cashflow" },
  { key: "account-type", label: "Per Tipe Akun" },
  { key: "balance-trend", label: "Tren Keuangan" },
  { key: "category-period", label: "Periode Kategori" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("cashflow");
  const [month, setMonth] = useState(currentMonth);

  // Hanya Cashflow yang terikat bulan (navigator di header); tab lain memakai
  // saldo saat ini atau rentang sendiri.
  return (
    <View className="flex-1 bg-white">
      <PageHeader
        title={
          tab === "cashflow" ? (
            <MonthNavigator
              month={month}
              allowAllTime={false}
              onChange={(next) => next && setMonth(next)}
            />
          ) : (
            "Laporan"
          )
        }
      />
      <TabSwitcher tabs={REPORT_TABS} active={tab} onChange={setTab} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
        {tab === "cashflow" && <CashflowSection month={month} />}
        {tab === "account-type" && <AccountTypeSection />}
        {tab === "balance-trend" && <BalanceTrendSection />}
        {tab === "category-period" && <CategoryPeriodSection />}
      </ScrollView>
    </View>
  );
}
