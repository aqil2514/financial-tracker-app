"use client";

import { Trash2 } from "lucide-react";

import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountEditDialog } from "../form/account-edit-dialog";
import { useAccounts } from "./use-accounts";
import { useDeleteAccount } from "./use-delete-account";

export function AccountList() {
  const { data: accounts, isLoading, error } = useAccounts();
  const deleteAccount = useDeleteAccount();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar Akun</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <p className="text-muted-foreground text-sm">Memuat...</p>
        )}
        {error && (
          <p className="text-destructive text-sm">
            Gagal memuat: {(error as Error).message}
          </p>
        )}
        {accounts?.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{account.name}</p>
                {account.group_name && (
                  <Badge variant="secondary">{account.group_name}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {formatRupiah(account.balance)}
              </p>
              {account.description && (
                <p className="text-muted-foreground text-xs">
                  {account.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <AccountEditDialog account={account} />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteAccount.mutate(account.id)}
                disabled={deleteAccount.isPending}
              >
                <Trash2 className="text-destructive size-4" />
              </Button>
            </div>
          </div>
        ))}
        {accounts && accounts.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Belum ada akun. Tambahkan lewat tombol di atas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
