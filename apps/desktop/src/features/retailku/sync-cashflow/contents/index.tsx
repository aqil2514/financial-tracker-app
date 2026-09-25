import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mainTabs } from "../shared/tab-mapping";
import { BaseTabs } from "@/components/pattern/base-tabs";

export function RetailkuSyncCashflowContent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sinkronisasi</CardTitle>
      </CardHeader>
      <CardContent>
        {/* <CashflowSyncPanel /> */}
        <CashflowSyncTab />
      </CardContent>
    </Card>
  );
}

const CashflowSyncTab = () => {
  return <BaseTabs items={mainTabs} />;
};
