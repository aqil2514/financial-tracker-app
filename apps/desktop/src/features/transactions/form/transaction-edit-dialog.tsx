"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";

import type { Transaction } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { TransactionForm } from "./transaction-form";
import { useUpdateTransaction } from "./use-update-transaction";

export function TransactionEditDialog({
  transaction,
  /** Dikontrol dari luar (mis. item di ListItemActionsMenu) — kalau
   * diisi, tombol pensil bawaan disembunyikan dan dialog dibuka/ditutup
   * lewat pasangan `open`/`onOpenChange` ini. */
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  transaction: Transaction;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isControlled = controlledOpen !== undefined;

  // Saat controlled, `controlledOpen` adalah SATU-SATUNYA sumber
  // kebenaran untuk MERENDER Dialog — `open` internal dari useEntityForm
  // tidak pernah dibaca balik untuk itu. Sinkronisasi hanya SATU ARAH
  // (controlledOpen -> open internal, lewat effect di bawah) supaya
  // resetOnOpen tetap jalan; penutupan ke context sekarang EKSPLISIT
  // lewat onSuccess (dipanggil useEntityForm setelah mutation sukses,
  // sebelum form direset) — sama persis pola AccountEditDialog. Sebelum
  // fix ini, `open={open}` merender dari state internal DAN
  // handleOpenChange menyinkronkan dua arah — begitu submit sukses
  // menutup `open` internal tanpa memberi tahu context, dialog jadi
  // tidak bisa dibuka lagi lain kali (context/internal saling berbeda).
  const { open, setOpen, form, onSubmit, isPending } = useUpdateTransaction(
    transaction,
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
      title="Edit Transaksi"
      open={isControlled ? controlledOpen : open}
      onOpenChange={handleOpenChange}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
        transactionId={transaction.id}
      />
    </EntityFormDialog>
  );
}
