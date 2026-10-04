"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useDeleteTransaction } from "@/features/transactions";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { EditPaymentDialog } from "./edit-payment-form/edit-payment-dialog";
import { useDebtPayments, type DebtPaymentRow } from "./use-debt-payments";

/** Riwayat cicilan/pelunasan satu `debts` — dipakai di baris expandable
 * baik di dialog detail kontak (features/debts-summary/content/card/detail/)
 * maupun DebtListTable (features/debts/), supaya tidak terduplikasi. */
export function PaymentsList({ debtId }: { debtId: string }) {
  const { data: payments, isLoading } = useDebtPayments(debtId);
  const [editingPayment, setEditingPayment] = useState<DebtPaymentRow | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<DebtPaymentRow | null>(null);
  const deleteTransaction = useDeleteTransaction();

  if (isLoading) {
    return <p className="text-muted-foreground p-3 text-sm">Memuat cicilan...</p>;
  }

  if (!payments || payments.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">Belum ada cicilan tercatat.</p>;
  }

  return (
    <>
      <ul className="divide-y">
        {payments.map((payment) => (
          <li key={payment.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <div>
              <p>{formatDate(payment.date, "date-time")}</p>
              <p className="text-muted-foreground text-xs">{payment.account_name ?? "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-medium">{formatCurrency(payment.amount, "IDR")}</p>
              {/* Cicilan lama dari sebelum fix non_cash tersimpan tanpa
               * transaksi jejak (transaction_id NULL, lihat catatan
               * "Temuan BARU" di debt-receivable-tracking.md) — tidak ada
               * transaksi yang bisa diedit/dihapus utk baris ini, jadi
               * aksinya disembunyikan sama sekali alih-alih error. */}
              {payment.transaction_id != null && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setEditingPayment(payment)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-7"
                    onClick={() => setDeletingPayment(payment)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {editingPayment && (
        <EditPaymentDialog
          payment={editingPayment}
          open={editingPayment != null}
          onOpenChange={(next) => {
            if (!next) setEditingPayment(null);
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={deletingPayment != null}
        onOpenChange={(next) => {
          if (!next) setDeletingPayment(null);
        }}
        onConfirm={() => {
          if (!deletingPayment?.transaction_id) return;
          deleteTransaction.mutate(deletingPayment.transaction_id, {
            onSuccess: () => setDeletingPayment(null),
          });
        }}
        isPending={deleteTransaction.isPending}
        title="Hapus cicilan ini?"
        description="Transaksi jejaknya ikut terhapus. Kalau cicilan ini sebelumnya melunasi penuh, status piutang/utang kembali jadi Berjalan. Tindakan ini tidak bisa dibatalkan."
      />
    </>
  );
}
