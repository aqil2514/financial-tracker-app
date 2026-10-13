import { BaseTabItems } from "@/components/pattern/base-tabs";
import { BaseTabsUrl } from "@/components/pattern/base-tabs-url";
import { InvestmentsSummarySection } from "./summary";
import { InvestmentsDetailSection } from "./detail";

const investmentsTabs: BaseTabItems[] = [
  { value: "ringkasan", label: "Ringkasan", content: <InvestmentsSummarySection /> },
  { value: "detail", label: "Detail", content: <InvestmentsDetailSection /> },
];

export function InvestmentsContent() {
  return <BaseTabsUrl items={investmentsTabs} urlParam="tab" />;
}
