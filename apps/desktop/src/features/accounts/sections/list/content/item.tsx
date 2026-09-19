import React from "react";
import { Eye, Pencil, ScaleIcon, Trash2 } from "lucide-react";

import { useAccountsList } from "../context";
import { AccountWithBalance } from "../../../calculate-balance";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-currency";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";

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
  const { openDialog } = useAccountsList();

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
      <ListItemActionsMenu
        actions={[
          { label: "Lihat Detail", icon: Eye, onClick: () => openDialog(account, "detail") },
          { label: "Koreksi Saldo", icon: ScaleIcon, onClick: () => openDialog(account, "correction") },
          { label: "Edit", icon: Pencil, onClick: () => openDialog(account, "edit") },
          {
            label: "Hapus",
            icon: Trash2,
            variant: "destructive",
            onClick: () => openDialog(account, "delete"),
          },
        ]}
      />
    </div>
  );
};
