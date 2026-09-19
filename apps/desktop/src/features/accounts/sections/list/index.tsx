"use client";

import { Card } from "@/components/ui/card";
import {
  AccountDetailDialog,
  AccountBalanceCorrectionDialog,
  AccountEditDialog,
  DeleteAccountDialog,
} from "../../dialogs";
import { AccountsProvider, useAccountsList } from "./context";
import { AccountsCardHeader } from "./header";
import { AccountListContent } from "./content";
import { AccountsCardFooter } from "./footer";

export function AccountList() {
  return (
    <AccountsProvider>
      <Card>
        <AccountsCardHeader />
        <AccountListContent />
        <AccountsCardFooter />
      </Card>
      <AccountListDialogs />
    </AccountsProvider>
  );
}

/** Ke-4 dialog aksi (Detail/Koreksi/Edit/Hapus) di-render SEKALI di sini
 * — bukan per item — akun & jenis dialog yang aktif datang dari context
 * (context/), di-set lewat openDialog() dari action menu tiap
 * item. Item list sendiri jadi tidak perlu tahu apa-apa soal state dialog. */
function AccountListDialogs() {
  const { activeAccount, activeDialog, closeDialog } = useAccountsList();

  if (!activeAccount) return null;

  return (
    <>
      <AccountDetailDialog
        account={activeAccount}
        open={activeDialog === "detail"}
        onOpenChange={(open) => !open && closeDialog()}
      />
      <AccountBalanceCorrectionDialog
        account={activeAccount}
        open={activeDialog === "correction"}
        onOpenChange={(open) => !open && closeDialog()}
      />
      <AccountEditDialog
        account={activeAccount}
        open={activeDialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      />
      <DeleteAccountDialog
        account={activeAccount}
        open={activeDialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
      />
    </>
  );
}

export {
  useAccounts,
  accountsQueryKey,
  type AccountWithBalance,
} from "@/hooks/resources/use-accounts";
