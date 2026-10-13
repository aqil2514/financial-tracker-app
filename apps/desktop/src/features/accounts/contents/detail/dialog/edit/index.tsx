"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useInvestmentAccount } from "@/shared/investments/use-investment-account";
import { useAccountLabels } from "@/shared/labels/use-account-labels";
import { useAccountIsUsed } from "../../../../form/use-account-is-used";
import { AccountForm, accountValuesFromEntity, useUpdateAccount } from "../../form";
import { useAccountsDialog } from "../context";

export function AccountEditDialogController() {
  const { dialog, closeDialog } = useAccountsDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "edit";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <AccountEditDialog
      account={account}
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
    />
  );
}

function AccountEditDialog({
  account,
  open,
  onOpenChange,
}: {
  account: NonNullable<ReturnType<typeof useAccounts>["data"]>[number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: investmentAccount } = useInvestmentAccount(account.id);
  const { data: labelNames } = useAccountLabels(account.id);
  const { data: accountTypeLocked } = useAccountIsUsed(account.id);

  const { onSubmit, isPending } = useUpdateAccount(account, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
