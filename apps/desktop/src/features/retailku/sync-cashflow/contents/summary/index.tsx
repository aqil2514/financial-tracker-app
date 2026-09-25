import { Content } from "./content";
import { Header } from "./header";
import { RetailkuSyncCashflowSummaryProvider } from "./summary-context";

export function RetailkuSyncCashflowContentSummary() {
  return (
    <RetailkuSyncCashflowSummaryProvider>
      <div>
        <Header />
        <Content />
      </div>
    </RetailkuSyncCashflowSummaryProvider>
  );
}
