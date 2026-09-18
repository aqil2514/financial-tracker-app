import React from "react";
import { useAccountsList } from "../accounts-context";
import { AccountWithBalance } from "../calculate-balance";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-currency";
import { AccountEditDialog } from "../../form";
import { DeleteAccountDialog } from "../delete-account-dialog";

export function AccountListContentItem() {
  const { accounts } = useAccountsList();
  const isNoAccounts = accounts && accounts.length === 0;

  if (isNoAccounts) return <NoAccounts />;
  if (accounts) return <WithAccounts accounts={accounts} />;
  return null;
}

const NoAccounts = () => (
  <p className="text-muted-foreground text-sm">
    Belum ada akun. Tambahkan lewat tombol di atas.
  </p>
);

const WithAccounts: React.FC<{ accounts: AccountWithBalance[] }> = ({
  accounts,
}) => {
  return accounts.map((account) => (
    <AccountListItem account={account} key={account.id} />
  ));
};

const AccountListItem = ({ account }: { account: AccountWithBalance }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{account.name}</p>
          {account.group_name && (
            <Badge variant="secondary">{account.group_name}</Badge>
          )}
          {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatCurrency(account.balance, "IDR")}
        </p>
        {account.description && (
          <p className="text-muted-foreground text-xs">{account.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <AccountEditDialog account={account} />
        <DeleteAccountDialog account={account} />
      </div>
    </div>
  );
};
