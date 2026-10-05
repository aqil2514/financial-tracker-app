import { BaseTabItems, BaseTabs } from "@/components/pattern/base-tabs";
import { CashflowSection } from "./cashflow";
import { AccountTypeSection } from "./account-type";
import { BalanceTrendSection } from "./balance-trend";

const reportsTabs: BaseTabItems[] = [
  { value: "cashflow", label: "Cashflow", content: <CashflowSection /> },
  { value: "account-type", label: "Per Tipe Akun", content: <AccountTypeSection /> },
  { value: "balance-trend", label: "Tren Keuangan", content: <BalanceTrendSection /> },
];

export function ReportsContent() {
  return <BaseTabs items={reportsTabs} />;
}
