"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { AccountForm, useCreateAccount } from "@/features/accounts";

/** "Tambah Akun Investasi" dari header /investments — reuse penuh
 * `AccountForm`/`useCreateAccount` (sama dengan "Tambah Akun" di halaman
 * Akun), cuma `account_type` di-prefill 'investment' supaya field
 * `unit_label`/`current_market_value` langsung muncul tanpa user perlu
 * pilih tipe akun secara manual. BUKAN form transaksi — form pembelian
 * ("Catat Pembelian") ada di header halaman detail per akun. */
export function NewInvestmentAccountDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateAccount({
    initialValues: { account_type: "investment" },
  });

  return (
    <EntityFormDialog
      trigger={<Button variant="outline">Tambah Akun Investasi</Button>}
      title="Tambah Akun Investasi"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <AccountForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
