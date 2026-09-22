import { AiAssistantSection } from "./ai-assistant/ai-assistant-section";
import { AttachmentFolderSection } from "./attachment-folder/attachment-folder-section";
import { ImportDataSection } from "./import-data/import-data-section";
import { RetailkuIntegrationSection } from "./retailku-integration/retailku-integration-section";

export function SettingsContent() {
  return (
    <>
      <ImportDataSection />
      <AttachmentFolderSection />
      <AiAssistantSection />
      <RetailkuIntegrationSection />
    </>
  );
}
