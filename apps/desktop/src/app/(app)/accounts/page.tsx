import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { AccountFormDialog, AccountList } from "@/features/accounts";

export default function AccountsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Akun"
        description="Kelola akun dan saldo keuangan Anda"
        actions={<AccountFormDialog />}
      />
      <AccountList />
    </PageContainer>
  );
}
