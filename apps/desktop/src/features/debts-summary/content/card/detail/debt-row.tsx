"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { DEBT_STATUS_LABEL, DEBT_STATUS_VARIANT } from "@/shared/debts/status-labels";
import type { ContactDebtRow } from "@/shared/debts/use-contact-debts";
import { useDebtPayments } from "@/shared/debts/use-debt-payments";

/** Satu baris piutang/utang di dialog detail kontak — expandable, cicilan
 * (`debt_payments`) di-fetch LAZY lewat `useDebtPayments` cuma SETELAH
 * baris ini pernah dibuka (`hasOpened`, dipertahankan `true` walau
 * ditutup lagi supaya tidak re-fetch tiap toggle — `useDebtPayments`
 * sendiri yang bertanggung jawab caching lewat React Query). */
export function DebtRow({ debt }: { debt: ContactDebtRow }) {
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <Collapsible className="rounded-md border" onOpenChange={(open) => open && setHasOpened(true)}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/50">
        <div className="flex items-center gap-2">
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-panel-open:rotate-180" />
          <div>
            <p className="text-sm font-medium">{formatDate(debt.date, "date-time")}</p>
            <p className="text-muted-foreground text-xs">{debt.account_name ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium">{formatCurrency(debt.amount, "IDR")}</p>
            <p className="text-muted-foreground text-xs">
              Sisa {formatCurrency(debt.remaining, "IDR")}
            </p>
          </div>
          <Badge variant={DEBT_STATUS_VARIANT[debt.status]}>{DEBT_STATUS_LABEL[debt.status]}</Badge>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {hasOpened && <PaymentsList debtId={debt.id} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PaymentsList({ debtId }: { debtId: number }) {
  const { data: payments, isLoading } = useDebtPayments(debtId);

  if (isLoading) {
    return <p className="text-muted-foreground border-t p-3 text-sm">Memuat cicilan...</p>;
  }

  if (!payments || payments.length === 0) {
    return (
      <p className="text-muted-foreground border-t p-3 text-sm">Belum ada cicilan tercatat.</p>
    );
  }

  return (
    <ul className="divide-y border-t">
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
