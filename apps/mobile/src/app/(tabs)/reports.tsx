import { useState } from "react";
import { ScrollView, View } from "react-native";
import { MonthNavigator } from "@/components/month-navigator";
import { PageHeader } from "@/components/page-header";
import { TabSwitcher } from "@/components/tab-switcher";
import { AccountTypeSection } from "@/features/reports/account-type";
import { CashflowSection } from "@/features/reports/cashflow";
import { currentMonth } from "@/lib/utils";

type ReportTab = "cashflow" | "account-type";

const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: "cashflow", label: "Cashflow" },
  { key: "account-type", label: "Per Tipe Akun" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("cashflow");
  const [month, setMonth] = useState(currentMonth);

  // Per Tipe Akun adalah saldo saat ini (tidak terikat bulan), jadi
  // navigator bulan hanya ditampilkan untuk Cashflow.
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
        {tab === "cashflow" ? <CashflowSection month={month} /> : <AccountTypeSection />}
      </ScrollView>
    </View>
  );
}
