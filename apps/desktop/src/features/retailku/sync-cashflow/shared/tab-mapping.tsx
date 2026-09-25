import { RetailkuSyncCashflowContentSummary } from "../contents/summary";
import { BaseTabItems } from "@/components/pattern/base-tabs";
import { CashflowSummaryTab } from "../contents/summary/content/cashflow-summary";
import { CashflowAllocationTab } from "../contents/summary/content/cashflow-allocation";
import { CashflowDetailTab } from "../contents/summary/content/cashflow-detail";
import { ArApTab } from "../contents/summary/content/ar-ap";


export const mainTabs: BaseTabItems[] = [
  {
    value: "ringkasan",
    label: "Ringkasan",
    content: <RetailkuSyncCashflowContentSummary />
  },
  { value: "mapping", label: "Mapping", content: <p>Mapping</p> },
  {
    value: "konfigurasi",
    label: "Konfigurasi",
    content: <p>Konfigurasi</p>,
  },
];

export const summarySubTabs: BaseTabItems[] = [
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
