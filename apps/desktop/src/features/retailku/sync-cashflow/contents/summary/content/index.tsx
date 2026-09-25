import { BaseTabs } from "@/components/pattern/base-tabs";
import { summarySubTabs } from "../../../shared/tab-mapping";

export function Content(){
    return <BaseTabs items={summarySubTabs} />
}