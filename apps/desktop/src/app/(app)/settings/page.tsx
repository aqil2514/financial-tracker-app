import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import {
  AiAssistantSection,
  AttachmentFolderSection,
  ImportDataSection,
  RetailkuIntegrationSection,
} from "@/features/settings";

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Pengaturan aplikasi dan data Anda" />

      <ImportDataSection />
      <AttachmentFolderSection />
      <AiAssistantSection />
      <RetailkuIntegrationSection />
    </PageContainer>
  );
}
