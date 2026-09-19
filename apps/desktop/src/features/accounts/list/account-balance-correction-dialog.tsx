"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { FormFieldCurrency } from "@/components/form-fields";
import type { AccountWithBalance } from "./calculate-balance";
import {
  accountBalanceCorrectionSchema,
  type AccountBalanceCorrectionFormOutput,
  type AccountBalanceCorrectionFormValues,
} from "./account-balance-correction.schema";
import { useCorrectAccountBalance } from "./use-correct-account-balance";

/** Koreksi saldo akun dengan membuat 1 transaksi penyesuaian otomatis
 * sebesar selisih antara saldo berjalan sekarang dan saldo yang
 * seharusnya diinput user — bukan mengubah initial_balance secara
 * langsung, supaya riwayat transaksi tetap konsisten dengan kontrak
 * balance = initial_balance + akumulasi transaksi. */
export function AccountBalanceCorrectionDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountWithBalance;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<AccountBalanceCorrectionFormValues, unknown, AccountBalanceCorrectionFormOutput>({
    resolver: zodResolver(accountBalanceCorrectionSchema),
    defaultValues: { targetBalance: account.balance },
  });

  useEffect(() => {
    if (open) form.reset({ targetBalance: account.balance });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account.balance]);

  const correctBalance = useCorrectAccountBalance();

  function onSubmit(values: AccountBalanceCorrectionFormOutput) {
    correctBalance.mutate(
      {
        accountId: account.id,
        targetBalance: values.targetBalance,
        currentBalance: account.balance,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  }

  return (
    <EntityFormDialog title="Koreksi Saldo" open={open} onOpenChange={onOpenChange}>
      <p className="text-muted-foreground text-sm">
        Saldo berjalan {account.name} saat ini dianggap tidak sesuai kenyataan.
        Masukkan saldo yang seharusnya — sistem akan membuat transaksi
        penyesuaian otomatis sebesar selisihnya.
      </p>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormFieldCurrency form={form} name="targetBalance" label="Saldo Seharusnya" />
        <DialogFooter>
          <Button type="submit" disabled={correctBalance.isPending}>
            {correctBalance.isPending ? "Menyimpan..." : "Koreksi Saldo"}
          </Button>
        </DialogFooter>
      </form>
    </EntityFormDialog>
  );
}
