"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccounts } from "@/features/accounts";
import { useInvestmentAccountLabels } from "@/shared/investments/use-investment-account-labels";
import { InvestmentAccountCard } from "./investment-account-card";

export function InvestmentsDetailSection() {
  const { data: accounts, isLoading } = useAccounts();
  const investmentAccounts = (accounts ?? []).filter(
    (account) => account.account_type === "investment"
  );
  const { data: accountLabels } = useInvestmentAccountLabels();

  const labelsByAccountId = new Map<string, string[]>();
  for (const row of accountLabels ?? []) {
    const existing = labelsByAccountId.get(row.account_id) ?? [];
    existing.push(row.name);
    labelsByAccountId.set(row.account_id, existing);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Akun Investasi</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        ) : investmentAccounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada akun investasi. Buat lewat tombol "Tambah Akun Investasi" di atas.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {investmentAccounts.map((account) => (
              <InvestmentAccountCard
                account={account}
                labels={labelsByAccountId.get(account.id) ?? []}
                key={account.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
