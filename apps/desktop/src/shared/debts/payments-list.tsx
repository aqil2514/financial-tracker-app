"use client";

import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useDebtPayments } from "./use-debt-payments";

/** Riwayat cicilan/pelunasan satu `debts` — dipakai di baris expandable
 * baik di dialog detail kontak (features/debts-summary/content/card/detail/)
 * maupun DebtListTable (features/debts/), supaya tidak terduplikasi. */
export function PaymentsList({ debtId }: { debtId: string }) {
  const { data: payments, isLoading } = useDebtPayments(debtId);

  if (isLoading) {
    return <p className="text-muted-foreground p-3 text-sm">Memuat cicilan...</p>;
  }

  if (!payments || payments.length === 0) {
    return <p className="text-muted-foreground p-3 text-sm">Belum ada cicilan tercatat.</p>;
  }

  return (
    <ul className="divide-y">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between gap-2 p-3 text-sm">
          <div>
            <p>{formatDate(payment.date, "date-time")}</p>
            <p className="text-muted-foreground text-xs">{payment.account_name ?? "—"}</p>
          </div>
          <p className="font-medium">{formatCurrency(payment.amount, "IDR")}</p>
        </li>
      ))}
    </ul>
  );
}
