"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccounts } from "@/features/accounts";
import { useAllForexAccountSummaries } from "@/shared/forex/use-forex-queries";
import { ForexAccountCard } from "./forex-account-card";

export function ForexContent() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: summaries } = useAllForexAccountSummaries();
  const forexAccounts = (accounts ?? []).filter((account) => account.account_type === "forex");
  const summaryByAccountId = new Map((summaries ?? []).map((row) => [row.account_id, row]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Akun Valas</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        ) : forexAccounts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Belum ada akun valas. Buat lewat tombol "Tambah Akun Valas" di atas.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {forexAccounts.map((account) => (
              <ForexAccountCard
                key={account.id}
                account={account}
                summary={summaryByAccountId.get(account.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
