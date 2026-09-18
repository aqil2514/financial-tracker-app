"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getDb } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/resources/use-accounts";
import { useDeleteAccount } from "./use-delete-account";

type RelationAction = "unassign" | "reassign";

function useTransactionCountByAccount(accountId: number) {
  return useQuery({
    queryKey: ["accounts", "transaction-count", accountId],
    queryFn: async () => {
      const db = await getDb();
      const [{ count }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM transactions WHERE account_id = $1 OR transfer_account_id = $1",
        [accountId]
      );
      return count;
    },
  });
}

export function DeleteAccountDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [transactionAction, setTransactionAction] = useState<RelationAction>("unassign");
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);

  const { data: accounts } = useAccounts();
  const { data: transactionCount } = useTransactionCountByAccount(account.id);
  const deleteAccount = useDeleteAccount();

  useEffect(() => {
    if (open) {
      setTransactionAction("unassign");
      setTargetAccountId(null);
    }
  }, [open]);

  const otherAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.id !== account.id),
    [accounts, account.id]
  );

  const hasTransactions = (transactionCount ?? 0) > 0;
  const isTargetAccountValid =
    targetAccountId != null && otherAccounts.some((a) => String(a.id) === targetAccountId);

  function handleConfirm() {
    deleteAccount.mutate(
      {
        id: account.id,
        transactionAction: hasTransactions ? transactionAction : undefined,
        targetAccountId:
          hasTransactions && transactionAction === "reassign" && isTargetAccountValid
            ? Number(targetAccountId)
            : undefined,
      },
      { onSuccess: () => setOpen(false) }
    );
  }

  const canConfirm =
    !hasTransactions ||
    transactionAction === "unassign" ||
    (transactionAction === "reassign" && isTargetAccountValid);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2 className="text-destructive size-4" />
      </DialogTrigger>
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
          <div className="space-y-2">
            <ToggleGroup
              value={[transactionAction]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  setTransactionAction(values[values.length - 1] as RelationAction);
                }
              }}
              className="w-full"
            >
              <ToggleGroupItem value="unassign" className="flex-1">
                Lepas ke Tanpa Akun
              </ToggleGroupItem>
              <ToggleGroupItem
                value="reassign"
                className="flex-1"
                disabled={otherAccounts.length === 0}
              >
                Pindahkan ke akun lain
              </ToggleGroupItem>
            </ToggleGroup>
            {transactionAction === "reassign" && (
              <Select value={targetAccountId ?? ""} onValueChange={setTargetAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih akun tujuan...">
                    {(value: string | null) =>
                      otherAccounts.find((a) => String(a.id) === value)?.name ??
                      "Pilih akun tujuan..."
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {otherAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteAccount.isPending}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm || deleteAccount.isPending}
          >
            {deleteAccount.isPending ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
