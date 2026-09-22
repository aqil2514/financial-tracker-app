"use client";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { FormFieldCurrency } from "@/components/forms/form-fields";
import type { AccountWithBalance } from "../../calculate-balance";
import { useBalanceCorrectionForm } from "./use-balance-correction-form";

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
  const { form, onSubmit, isPending } = useBalanceCorrectionForm(account, open, onOpenChange);

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
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Koreksi Saldo"}
          </Button>
        </DialogFooter>
      </form>
    </EntityFormDialog>
  );
}
