"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format-currency";
import type { AccountWithBalance } from "../../sections/list/calculate-balance";

/** Tampilan read-only ringkasan akun — saldo awal, saldo berjalan, grup,
 * dan status, tanpa harus buka form Edit hanya untuk melihat. */
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
