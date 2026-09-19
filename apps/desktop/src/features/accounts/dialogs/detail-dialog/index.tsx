"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import type { AccountWithBalance } from "../../calculate-balance";
import { RecentTransactionsList } from "./recent-transactions-list";

/** Tampilan read-only ringkasan akun — saldo, grup, status, deskripsi,
 * dan transaksi terbaru akun ini tanpa harus buka form Edit atau pindah
 * ke halaman Transaksi lalu filter manual by akun. */
export function AccountDetailDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {account.name}
            {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
            {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Saldo Berjalan</span>
            <span className="font-medium">{formatCurrency(account.balance, "IDR")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Saldo Awal</span>
            <span>{formatCurrency(account.initial_balance, "IDR")}</span>
          </div>

          {account.description && (
            <div className="space-y-2">
              <p className="text-muted-foreground">Deskripsi</p>
              <p>{account.description}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Transaksi Terbaru</p>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/transactions" />}
              >
                Lihat semua
              </Button>
            </div>
            <ScrollArea className="h-64">
              <div className="pr-4">
                <RecentTransactionsList accountId={account.id} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
