import { BaseTabItems } from "@/components/pattern/base-tabs";
import { BaseTabsUrl } from "@/components/pattern/base-tabs-url";
import { ThirdPartySummarySection } from "./summary";
import { ThirdPartyAccountsSection } from "./accounts";
import { ThirdPartyDataSection } from "./data";

const thirdPartyTabs: BaseTabItems[] = [
  {
    value: "summary",
    label: "Ringkasan",
    content: <ThirdPartySummarySection />,
  },
  {
    value: "accounts",
    label: "Akun",
    content: <ThirdPartyAccountsSection />,
  },
  {
    value: "data",
    label: "Data",
    content: <ThirdPartyDataSection />,
  },
];

export function ThirdPartyContent() {
  return <BaseTabsUrl items={thirdPartyTabs} urlParam="tab" />;
}
