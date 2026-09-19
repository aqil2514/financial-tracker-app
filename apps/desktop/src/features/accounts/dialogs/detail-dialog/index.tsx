"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AccountWithBalance } from "../../calculate-balance";
import { AccountDetailProvider } from "./detail-context";
import { LeftSide } from "./left-side";
import { RightSide } from "./right-side";

/** Tampilan read-only ringkasan akun — saldo, grup, status, deskripsi,
 * dan ringkasan pemasukan/pengeluaran per bulan, tanpa harus buka form
 * Edit hanya untuk melihat. */
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
      <DialogContent className="sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {account.name}
            {account.group_name && <Badge variant="secondary">{account.group_name}</Badge>}
            {!account.is_active && <Badge variant="outline">Nonaktif</Badge>}
          </DialogTitle>
        </DialogHeader>

        <AccountDetailProvider onCloseParentDialog={() => onOpenChange(false)}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <LeftSide account={account} />
            <RightSide account={account} />
          </div>
        </AccountDetailProvider>
      </DialogContent>
    </Dialog>
  );
}
