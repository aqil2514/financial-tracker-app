"use client";

import { Pencil, Trash2 } from "lucide-react";

import { useAccounts } from "@/features/accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import { formatCurrency } from "@/lib/format-currency";
import { useThirdPartyAccountDialog } from "./dialog/context";

export function ThirdPartyAccountList() {
  const { data: accounts, isLoading, error } = useAccounts();
  const { openDialog } = useThirdPartyAccountDialog();

  const thirdPartyAccounts = (accounts ?? []).filter(
    (account) => account.account_type === "third_party"
  );

  if (isLoading || error) {
    return (
      <Card>
        <CardContent>
          <QueryState isLoading={isLoading} error={error} />
        </CardContent>
      </Card>
    );
  }

  if (thirdPartyAccounts.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Belum ada akun Dana Pihak Ketiga. Tambahkan lewat tombol di atas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {thirdPartyAccounts.map((account) => {
        const AccountIcon = resolveAccountIcon(account.icon);
        const colorText = resolveAccountColorText(account.color);

        return (
          <Card key={account.id}>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AccountIcon className={`size-5 shrink-0 ${colorText}`} />
                  <p className="font-semibold">{account.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => openDialog("edit", account.id)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-7"
                    onClick={() => openDialog("delete", account.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-lg font-medium">{formatCurrency(account.balance, "IDR")}</p>
              {account.description && (
                <p className="text-muted-foreground text-xs">{account.description}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
