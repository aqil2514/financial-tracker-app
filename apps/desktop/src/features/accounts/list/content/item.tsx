import React from "react";
import { useAccountsList } from "../accounts-context";
import { AccountWithBalance } from "../calculate-balance";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-currency";
import { AccountEditDialog } from "../../form";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

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
  const { deleteAccount, isDeletingAccount } = useAccountsList();
  return accounts.map((account) => (
    <AccountListItem
      account={account}
      isDeleting={isDeletingAccount}
      key={account.id}
      onDelete={() => deleteAccount(account.id)}
    />
  ));
};

const AccountListItem = ({
  account,
  onDelete,
  isDeleting,
}: {
  account: AccountWithBalance;
  onDelete: () => void;
  isDeleting: boolean;
}) => {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{account.name}</p>
          {account.group_name && (
            <Badge variant="secondary">{account.group_name}</Badge>
          )}
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
        <ConfirmDeleteButton
          onConfirm={onDelete}
          isPending={isDeleting}
          title={`Hapus akun "${account.name}"?`}
          description="Seluruh transaksi yang terkait dengan akun ini tidak akan ikut terhapus, tapi referensinya akan hilang."
        />
      </div>
    </div>
  );
};
