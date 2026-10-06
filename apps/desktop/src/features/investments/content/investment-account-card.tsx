"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import type { AccountWithBalance } from "@/features/accounts";

export function InvestmentAccountCard({ account }: { account: AccountWithBalance }) {
  const router = useRouter();
  const AccountIcon = resolveAccountIcon(account.icon);
  const colorText = resolveAccountColorText(account.color);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/investments/detail?id=${account.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/investments/detail?id=${account.id}`);
        }
      }}
      className="hover:bg-accent/50 cursor-pointer"
    >
      <CardHeader className="flex-row items-center gap-2">
        <AccountIcon className={`size-5 shrink-0 ${colorText}`} />
        <p className="font-semibold">{account.name}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-1">
          {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
          {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
        </div>
        <p className="text-lg font-medium">{formatCurrency(account.balance, "IDR")}</p>
        <p className="text-muted-foreground text-xs">Modal — nilai pasar &amp; P/L di halaman detail</p>
      </CardContent>
    </Card>
  );
}
