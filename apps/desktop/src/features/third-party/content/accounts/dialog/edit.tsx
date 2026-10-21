"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccounts } from "@/features/accounts";
import { AccountForm, accountValuesFromEntity, useUpdateAccount } from "@/features/accounts";
import { useAccountLabels } from "@/shared/labels/use-account-labels";
import { useThirdPartyAccountDialog } from "./context";

/** Edit akun `third_party` — reuse PENUH `AccountForm`/`useUpdateAccount`
 * dari `features/accounts` (pola sama `AccountEditDialogController`,
 * lihat features/accounts/contents/detail/dialog/edit/index.tsx), tanpa
 * `useInvestmentAccount`/`useDebtAccount` karena `third_party` tidak
 * punya tabel satelit (`accountValuesFromEntity` menerima `extra`
 * opsional — cukup `label_names` di sini). `account_type` TETAP bisa
 * diedit via form yang sama (tidak di-lock ke `third_party`) — konsisten
 * dengan AccountForm generik, user tetap bisa mengubah tipe akun kalau
 * memang perlu (mis. akun ternyata bukan titipan), dicegah otomatis oleh
 * `useUpdateAccount` kalau akun sudah dipakai transaksi.
 *
 * Dipecah 2 komponen (pola sama AccountEditDialogController) — hook yang
 * butuh `account.id` (mis. useAccountLabels, TIDAK ada guard `enabled`)
 * hanya boleh dipanggil SETELAH `account` dipastikan non-null, tidak bisa
 * di component yang sama dengan early return `if (!account) return null`
 * di atasnya (melanggar Rules of Hooks). */
export function ThirdPartyEditAccountDialog() {
  const { dialog, closeDialog } = useThirdPartyAccountDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "edit";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <EditDialog account={account} open={open} onOpenChange={(next) => !next && closeDialog()} />
  );
}

function EditDialog({
  account,
  open,
  onOpenChange,
}: {
  account: NonNullable<ReturnType<typeof useAccounts>["data"]>[number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: labelNames } = useAccountLabels(account.id);
  const { onSubmit, isPending } = useUpdateAccount(account, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Edit Akun Dana Pihak Ketiga</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={accountValuesFromEntity(account, { label_names: labelNames })}
          onSubmit={onSubmit}
          isPending={isPending}
          submitLabel="Simpan Perubahan"
        />
      </DialogContent>
    </Dialog>
  );
}
