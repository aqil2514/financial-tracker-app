"use client";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteAccountForm } from "./use-delete-account-form";
import { TransactionRelationPicker } from "./transaction-relation-picker";

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange: setOpen,
}: {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    transactionAction,
    setTransactionAction,
    targetAccountId,
    setTargetAccountId,
    otherAccounts,
    hasTransactions,
    transactionCount,
    canConfirm,
    handleConfirm,
    isPending,
  } = useDeleteAccountForm(account, open, setOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus akun &quot;{account.name}&quot;?</DialogTitle>
          <DialogDescription>
            {hasTransactions
              ? `Akun ini masih dipakai oleh ${transactionCount} transaksi. Pilih apa yang terjadi pada transaksi tersebut.`
              : "Tindakan ini tidak bisa dibatalkan."}
          </DialogDescription>
        </DialogHeader>

        {hasTransactions && (
          <TransactionRelationPicker
            transactionAction={transactionAction}
            onTransactionActionChange={setTransactionAction}
            targetAccountId={targetAccountId}
            onTargetAccountIdChange={setTargetAccountId}
            otherAccounts={otherAccounts}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || isPending}
          >
            {isPending ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
