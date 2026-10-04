import { Building2, Eye, Pencil, ScaleIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAccountsList } from "../context";
import { AccountWithBalance } from "../../../calculate-balance";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { ListItemActionsMenu } from "@/components/list-item-actions-menu";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";

export function AccountCard({
  account,
  linkedRetailkuAccounts,
}: {
  account: AccountWithBalance;
  linkedRetailkuAccounts: { retailkuAccountName: string }[];
}) {
  const router = useRouter();
  const { openDialog } = useAccountsList();
  const AccountIcon = resolveAccountIcon(account.icon);
  const colorText = resolveAccountColorText(account.color);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/accounts/detail?id=${account.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/accounts/detail?id=${account.id}`);
        }
      }}
      className="hover:bg-accent/50 cursor-pointer"
    >
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AccountIcon className={`size-5 shrink-0 ${colorText}`} />
          <p className="font-semibold">{account.name}</p>
        </div>
        {/* stopPropagation: menu aksi (Lihat Detail/Koreksi/Edit/Hapus) buka
         * dialog masing-masing, TIDAK boleh ikut men-trigger navigasi klik
         * card di baliknya. */}
        <div onClick={(e) => e.stopPropagation()}>
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
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
          {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
          {linkedRetailkuAccounts.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <Building2 className="size-3" />
              Retailku: {linkedRetailkuAccounts.map((row) => row.retailkuAccountName).join(", ")}
            </Badge>
          )}
        </div>
        <p className="text-lg font-medium">{formatCurrency(account.balance, "IDR")}</p>
        {account.description && (
          <p className="text-muted-foreground text-xs">{account.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
