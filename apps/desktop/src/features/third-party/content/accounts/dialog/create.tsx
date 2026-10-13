"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { AccountForm, useCreateAccount } from "@/features/accounts";
import { useThirdPartyAccountDialog } from "./context";

/** `useCreateAccount` mengelola `open`/`setOpen` SENDIRI (internal ke
 * `useEntityForm`) -- tidak menerima `open` dari context luar. Jadi
 * context dialog fitur ini (`useThirdPartyAccountDialog`) cuma menentukan
 * apakah komponen ini DI-MOUNT (gate render), bukan `open` sungguhan
 * yang dipakai `<Dialog>` -- begitu mounted, `open` sungguhan ikut
 * `useCreateAccount`: auto-buka saat mount, dan saat dia balik ke
 * `false` (submit sukses/batal), `closeDialog()` context dipanggil
 * balik supaya komponen ini unmount. Satu sumber kebenaran untuk
 * "apakah dialog ini TERBUKA" tetap `useCreateAccount`. */
export function ThirdPartyCreateAccountDialog() {
  const { closeDialog } = useThirdPartyAccountDialog();
  const { open, setOpen, form, onSubmit, isPending } = useCreateAccount({
    initialValues: { account_type: "third_party" },
  });

  useEffect(() => {
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) closeDialog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <EntityFormDialog
      title="Tambah Akun Dana Pihak Ketiga"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <AccountForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
