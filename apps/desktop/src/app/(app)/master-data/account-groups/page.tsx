import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountGroupList, AccountGroupFormDialog } from "@/features/account-groups";

export default function AccountGroupsPage() {
  return (
    <PageContainer>
      <PageHeader title="Grup Akun" description="Kelola pengelompokan akun Anda" />
      <Card>
        <CardHeader>
          <CardTitle>Daftar Grup Akun</CardTitle>
          <CardAction>
            <AccountGroupFormDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <AccountGroupList />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
