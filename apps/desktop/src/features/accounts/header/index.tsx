import { PageHeader } from "@/components/page-header";
import { BalanceConsistencyCheckDialog } from "@/shared/balance-consistency-check/balance-consistency-check-dialog";

export function AccountsHeader() {
  return (
    <PageHeader
      title="Akun"
      description="Kelola akun dan saldo keuangan Anda"
      actions={<BalanceConsistencyCheckDialog />}
    />
  );
}
