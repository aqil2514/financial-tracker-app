"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useInvestmentAccount } from "@/shared/investments/use-investment-account";
import { useAccountLabels } from "@/shared/labels/use-account-labels";
import {
  AccountForm,
  accountValuesFromEntity,
  useUpdateAccount,
} from "@/features/accounts";
import { useAccountIsUsed } from "./use-account-is-used";

export function AccountEditDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);

  const { data: investmentAccount } = useInvestmentAccount(account.id);
  const { data: labelNames } = useAccountLabels(account.id);
  const { data: accountTypeLocked } = useAccountIsUsed(account.id);

  const { onSubmit, isPending } = useUpdateAccount(account, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Edit Akun</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={accountValuesFromEntity(account, {
            unit_label: investmentAccount?.unit_label,
            current_market_value: investmentAccount?.current_market_value,
            label_names: labelNames,
          })}
          onSubmit={onSubmit}
          isPending={isPending}
          submitLabel="Simpan Perubahan"
          accountTypeLocked={accountTypeLocked ?? false}
        />
      </DialogContent>
    </Dialog>
  );
}
