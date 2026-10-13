import { PageContainer } from "@/components/page-container";
import { ThirdPartyContent, ThirdPartyHeader } from "@/features/third-party";

export default function ThirdPartyPage() {
  return (
    <PageContainer maxWidth="6xl">
      <ThirdPartyHeader />
      <ThirdPartyContent />
    </PageContainer>
  );
}
