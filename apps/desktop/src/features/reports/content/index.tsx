import { BaseTabItems, BaseTabs } from "@/components/pattern/base-tabs";
import { CashflowSection } from "./cashflow";

const reportsTabs: BaseTabItems[] = [
  { value: "cashflow", label: "Cashflow", content: <CashflowSection /> },
  { value: "account-type", label: "Per Tipe Akun", content: <ComingSoon /> },
  { value: "balance-trend", label: "Tren Keuangan", content: <ComingSoon /> },
];

export function ReportsContent() {
  return <BaseTabs items={reportsTabs} />;
}

function ComingSoon() {
  return <p className="text-muted-foreground text-sm py-8 text-center">Segera hadir.</p>;
}
