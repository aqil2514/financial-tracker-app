import { BaseTabItems } from "@/components/pattern/base-tabs";
import { BaseTabsUrl } from "@/components/pattern/base-tabs-url";
import { AccountsSummarySection } from "./summary";
import { AccountsDetailSection } from "./detail";

const accountsTabs: BaseTabItems[] = [
  {
    value: "summary",
    label: "Ringkasan",
    content: <AccountsSummarySection />,
  },
  {
    value: "detail",
    label: "Detail",
    content: <AccountsDetailSection />,
  },
];

export function AccountsContent() {
  return <BaseTabsUrl items={accountsTabs} urlParam="tab" />;
}
