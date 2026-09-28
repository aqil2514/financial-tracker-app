import { BaseTabItems, BaseTabs } from "@/components/pattern/base-tabs";
import { CashflowSummaryTab } from "./cashflow-summary";
import { CashflowAllocationTab } from "./cashflow-allocation";
import { CashflowDetailTab } from "./cashflow-detail";
import { ArApTab } from "./ar-ap";

const summarySubTabs: BaseTabItems[] = [
  {
    value: "summary",
    label: "Ringkasan",
    content: <CashflowSummaryTab />,
  },
  {
    value: "allocation",
    label: "Alokasi",
    content: <CashflowAllocationTab />,
  },
  {
    value: "detail",
    label: "Pergerakan",
    content: <CashflowDetailTab />,
  },
  { value: "ar-ap", label: "Utang Piutang", content: <ArApTab /> },
];

export function Content() {
  return <BaseTabs items={summarySubTabs} />;
}
