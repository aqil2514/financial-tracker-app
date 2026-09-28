import { PreviewSyncSection } from "./preview-sync-section";
import { SyncFromSection } from "./sync-from-section";
import { SyncModeSection } from "./sync-mode-section";
import { SyncNowButton } from "./sync-now-button";

export function Contents() {
  return (
    <div className="max-w-xl space-y-6">
      <SyncModeSection />
      <SyncFromSection />
      <PreviewSyncSection />
      <SyncNowButton />
    </div>
  );
}
