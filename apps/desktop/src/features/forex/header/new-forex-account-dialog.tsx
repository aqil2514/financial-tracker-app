"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AccountForm, defaultAccountValues, useCreateAccount } from "@/features/accounts";

// Reuse AccountForm/useCreateAccount, account_type di-prefill 'forex' supaya field negara,
// mata uang, dan kurs langsung muncul. Beli/jual ada di header halaman detail per akun.
export function NewForexAccountDialog() {
  const [open, setOpen] = useState(false);

  const { onSubmit, isPending } = useCreateAccount({
    onCreated: () => setOpen(false),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Tambah Akun Valas</Button>} />
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Tambah Akun Valas</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={{ ...defaultAccountValues(), account_type: "forex" }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
