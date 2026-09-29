"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import { PayDebtForm } from "./pay-debt-form";
import { usePayDebt } from "./use-pay-debt";

type PayDebtDialogProps = {
  debt: DebtListRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Dialog "Bayar" per baris debt — dipicu dari menu aksi di
 * DebtListTable, SATU instance dialog dipakai bergantian untuk baris
 * mana pun yang sedang dipilih (mengikuti `debt` yang dikirim dari
 * pemanggil), bukan satu dialog per baris.
 *
 * `open`/`onOpenChange` di sini (dari context tabel) adalah SATU-SATUNYA
 * sumber kebenaran untuk merender Dialog — state `open` internal dari
 * useEntityForm tidak pernah dibaca balik untuk itu, cuma disinkronkan
 * SATU ARAH lewat effect di bawah supaya `resetOnOpen` tetap jalan.
 * Penutupan setelah submit sukses EKSPLISIT lewat `onSuccess`. Pola ini
 * sama persis dengan AccountEditDialog (lihat catatan di sana) — dulu
 * sinkronisasi dua arah pernah bikin dialog macet (kadang selalu
 * terbuka, kadang selalu tertutup) karena race antara "mutation sukses
 * menutup dialog lewat state internal" vs "effect menyinkronkan balik
 * ke context".
 */
export function PayDebtDialog({ debt, open: controlledOpen, onOpenChange }: PayDebtDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = usePayDebt(debt, () =>
    onOpenChange(false)
  );

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title={debt.type === "receivable" ? "Catat Pelunasan Piutang" : "Catat Pembayaran Utang"}
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <PayDebtForm debt={debt} form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}
