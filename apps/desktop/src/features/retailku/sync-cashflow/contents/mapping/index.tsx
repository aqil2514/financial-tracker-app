import { Contents } from "./contents";
import { RetailkuSyncCashflowMappingProvider } from "./context";
import { Header } from "./header";

export function RetailkuSyncCashflowContentMapping() {
  return (
    <RetailkuSyncCashflowMappingProvider>
      <div className="space-y-4">
        <Header />
        <Contents />
      </div>
    </RetailkuSyncCashflowMappingProvider>
  );
}
