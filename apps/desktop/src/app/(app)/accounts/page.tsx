import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { AccountBalancePieChart, AccountFormDialog, AccountList } from "@/features/accounts";

export default function AccountsPage() {
  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Akun"
        description="Kelola akun dan saldo keuangan Anda"
        actions={<AccountFormDialog />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
        <AccountList />
        <AccountBalancePieChart />
      </div>
    </PageContainer>
  );
}
