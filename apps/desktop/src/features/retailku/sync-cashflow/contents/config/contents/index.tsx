import { ArApCashAccountSection } from "./ar-ap-cash-account-section";
import { DebtAccountsSection } from "./debt-accounts-section";
import { PreviewSyncSection } from "./preview-sync-section";
import { SyncFromSection } from "./sync-from-section";
import { SyncModeSection } from "./sync-mode-section";
import { SyncNowButton } from "./sync-now-button";

export function Contents() {
  return (
    <div className="max-w-xl space-y-6">
      <SyncModeSection />
      <ArApCashAccountSection />
      <DebtAccountsSection />
      <SyncFromSection />
      <PreviewSyncSection />
      <SyncNowButton />
    </div>
  );
}
