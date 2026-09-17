"use client";

import { formatRupiah } from "@/lib/format";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
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
              <ConfirmDeleteButton
                onConfirm={() => deleteAccount.mutate(account.id)}
                isPending={deleteAccount.isPending}
                title={`Hapus akun "${account.name}"?`}
                description="Seluruh transaksi yang terkait dengan akun ini tidak akan ikut terhapus, tapi referensinya akan hilang."
              />
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
