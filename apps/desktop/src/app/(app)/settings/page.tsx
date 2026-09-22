import { PageContainer } from "@/components/page-container";
import { SettingsContent, SettingsHeader } from "@/features/settings";

export default function SettingsPage() {
  return (
    <PageContainer>
      <SettingsHeader />
      <SettingsContent />
    </PageContainer>
  );
}
