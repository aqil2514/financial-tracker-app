"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AccountWithBalance } from "../../../../calculate-balance";
import { AccountBalanceCorrectionForm, useBalanceCorrectionForm } from "../../form/balance-correction";

export function AccountBalanceCorrectionDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { onSubmit, isPending } = useBalanceCorrectionForm(account, onOpenChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koreksi Saldo</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Saldo berjalan {account.name} saat ini dianggap tidak sesuai kenyataan.
          Masukkan saldo yang seharusnya — sistem akan membuat transaksi
          penyesuaian otomatis sebesar selisihnya.
        </p>
        <AccountBalanceCorrectionForm
          accountType={account.account_type}
          defaultValues={{ targetBalance: account.balance, countAsCash: true }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
