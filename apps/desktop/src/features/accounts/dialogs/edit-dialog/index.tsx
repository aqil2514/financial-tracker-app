"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { AccountForm } from "../../form/account-form";
import { useUpdateAccount } from "../../form/use-update-account";

export function AccountEditDialog({
  account,
  /** Dikontrol dari luar (mis. item di ListItemActionsMenu) — kalau
   * diisi, tombol pensil bawaan disembunyikan dan dialog dibuka/ditutup
   * lewat pasangan `open`/`onOpenChange` ini. */
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  account: Account;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;

  // Saat controlled, `controlledOpen` (context) adalah SATU-SATUNYA
  // sumber kebenaran untuk MERENDER Dialog — `open` internal dari
  // useEntityForm tidak pernah dibaca balik untuk itu. Sinkronisasi
  // hanya SATU ARAH (controlledOpen -> open internal, lewat effect di
  // bawah) supaya resetOnOpen tetap jalan; sebelumnya ada sinkronisasi
  // DUA ARAH (open internal juga menulis balik ke context), dan race
  // antara "mutation sukses menutup dialog lewat open internal" vs
  // "effect menyinkronkan balik ke context" membuat dialog macet (kadang
  // selalu tertutup, kadang selalu terbuka, tergantung urutan render).
  // Penutupan ke context sekarang EKSPLISIT lewat onSuccess (dipanggil
  // useEntityForm setelah mutation sukses, sebelum form direset).
  const { open, setOpen, form, onSubmit, isPending } = useUpdateAccount(
    account,
    () => setControlledOpen?.(false)
  );

  useEffect(() => {
    if (isControlled) setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledOpen]);

  function handleOpenChange(next: boolean) {
    if (isControlled) {
      setControlledOpen?.(next);
    } else {
      setOpen(next);
    }
  }

  return (
    <EntityFormDialog
      trigger={
        isControlled ? undefined : (
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-4" />
          </Button>
        )
      }
      title="Edit Akun"
      open={isControlled ? controlledOpen : open}
      onOpenChange={handleOpenChange}
    >
      <AccountForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
      />
    </EntityFormDialog>
  );
}
