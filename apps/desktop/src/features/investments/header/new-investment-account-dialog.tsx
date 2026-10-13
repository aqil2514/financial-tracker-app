"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AccountForm, defaultAccountValues, useCreateAccount } from "@/features/accounts";

/** "Tambah Akun Investasi" dari header /investments — reuse penuh
 * `AccountForm`/`useCreateAccount` (sama dengan "Tambah Akun" di halaman
 * Akun), cuma `account_type` di-prefill 'investment' supaya field
 * `unit_label`/`current_market_value` langsung muncul tanpa user perlu
 * pilih tipe akun secara manual. BUKAN form transaksi — form pembelian
 * ("Catat Pembelian") ada di header halaman detail per akun. */
export function NewInvestmentAccountDialog() {
  const [open, setOpen] = useState(false);

  const { onSubmit, isPending } = useCreateAccount({
    onCreated: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Tambah Akun Investasi</Button>} />
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Tambah Akun Investasi</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={{ ...defaultAccountValues(), account_type: "investment" }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
