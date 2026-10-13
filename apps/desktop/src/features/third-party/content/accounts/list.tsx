"use client";

import { useAccounts } from "@/features/accounts";
import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import { formatCurrency } from "@/lib/format-currency";

export function ThirdPartyAccountList() {
  const { data: accounts, isLoading, error } = useAccounts();

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
              <div className="flex items-center gap-2">
                <AccountIcon className={`size-5 shrink-0 ${colorText}`} />
                <p className="font-semibold">{account.name}</p>
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
