import React, { useState } from "react";
import { Eye, Pencil, ScaleIcon, Trash2 } from "lucide-react";

import { useAccountsList } from "../accounts-context";
import { AccountWithBalance } from "../calculate-balance";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format-currency";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";
import {
  AccountEditDialog,
  AccountDetailDialog,
  AccountBalanceCorrectionDialog,
  DeleteAccountDialog,
} from "../../../dialogs";

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
  const [detailOpen, setDetailOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
          { label: "Lihat Detail", icon: Eye, onClick: () => setDetailOpen(true) },
          { label: "Koreksi Saldo", icon: ScaleIcon, onClick: () => setCorrectionOpen(true) },
          { label: "Edit", icon: Pencil, onClick: () => setEditOpen(true) },
          {
            label: "Hapus",
            icon: Trash2,
            variant: "destructive",
            onClick: () => setDeleteOpen(true),
          },
        ]}
      />
      <AccountDetailDialog account={account} open={detailOpen} onOpenChange={setDetailOpen} />
      <AccountBalanceCorrectionDialog
        account={account}
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
      />
      <AccountEditDialog account={account} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteAccountDialog account={account} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
};
