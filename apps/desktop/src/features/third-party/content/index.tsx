import { BaseTabItems, BaseTabs } from "@/components/pattern/base-tabs";
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
  return <BaseTabs items={thirdPartyTabs} />;
}
