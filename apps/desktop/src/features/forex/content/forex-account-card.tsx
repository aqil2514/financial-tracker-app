"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorText } from "@/lib/account-colors";
import type { AccountWithBalance } from "@/features/accounts";
import { formatForexUnit, formatRate } from "@/shared/forex/forex-format";
import type { ForexAccountSummaryRow } from "@/shared/forex/use-forex-queries";

export function ForexAccountCard({
  account,
  summary,
}: {
  account: AccountWithBalance;
  summary: ForexAccountSummaryRow | undefined;
}) {
  const router = useRouter();
  const AccountIcon = resolveAccountIcon(account.icon);
  const colorText = resolveAccountColorText(account.color);
  const detailUrl = `/forex/detail?id=${account.id}`;

  const unit = summary?.remaining_unit ?? 0;
  const rate = summary?.current_rate ?? 0;
  const hasRate = rate > 0;
  const value = unit * rate;
  const pl = value - account.balance;
  const plColor = pl >= 0 ? "text-green-600" : "text-red-600";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => router.push(detailUrl)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(detailUrl);
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
          {summary && <Badge variant="secondary">{summary.currency}</Badge>}
          {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
          {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
        </div>
        <p className="text-lg font-medium">{summary ? formatForexUnit(unit, summary.currency) : "—"}</p>
        <p className="text-muted-foreground text-xs">Modal {formatCurrency(account.balance, "IDR")}</p>
        {hasRate ? (
          <p className="text-xs">
            Nilai terkini {formatCurrency(value, "IDR")}{" "}
            <span className={plColor}>
              ({pl >= 0 ? "+" : ""}
              {formatCurrency(pl, "IDR")})
            </span>
          </p>
        ) : null}
        {hasRate ? (
          <p className="text-muted-foreground text-xs">
            Kurs ≈ {formatRate(rate)} per {summary?.currency}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Kurs terkini belum diisi</p>
        )}
      </CardContent>
    </Card>
  );
}
