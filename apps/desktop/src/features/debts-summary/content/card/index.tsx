"use client";

import { Card } from "@/components/ui/card";
import type { ContactDebtSummary } from "@/shared/debts/use-contact-summary";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import { PayDebtDialog } from "@/shared/debts/pay-debt-form/pay-debt-dialog";
import { ContactCardProvider, useContactCard } from "./context";
import { ContactCardHeader } from "./header";
import { ContactCardBody } from "./body";
import { ContactDetailDialog } from "./detail/detail-dialog";

/** Card satu kontak — orkestrator murni komposisi (lihat "Pola pemecahan
 * orchestrator + sub-view" di docs/rules/state-lifting-vs-context.md,
 * dan pola `AccountList` di features/accounts/sections/list/index.tsx):
 * bungkus Provider, susun Header + Body + dialog, tidak ada logic/akses
 * data langsung di sini. */
export function ContactCard({
  contact,
  oldestReceivable,
  oldestPayable,
}: {
  contact: ContactDebtSummary;
  oldestReceivable: DebtListRow | undefined;
  oldestPayable: DebtListRow | undefined;
}) {
  return (
    <ContactCardProvider
      contact={contact}
      oldestReceivable={oldestReceivable}
      oldestPayable={oldestPayable}
    >
      <Card>
        <ContactCardHeader />
        <ContactCardBody />
      </Card>
      <PayDebtDialogTrigger />
      <ContactDetailDialogTrigger />
    </ContactCardProvider>
  );
}

/** Dialog "Bayar" di-render SEKALI di sini (bukan di dalam Card, biar
 * konsisten dengan `AccountListDialogs`) — baris yang dibayar datang
 * dari context, di-set lewat tombol bayar di `body.tsx`. */
function PayDebtDialogTrigger() {
  const { payingDebt, setPayingDebt } = useContactCard();

  if (!payingDebt) return null;

  return (
    <PayDebtDialog
      debt={payingDebt}
      open={payingDebt != null}
      onOpenChange={(next) => {
        if (!next) setPayingDebt(null);
      }}
    />
  );
}

/** Dialog "Detail" — sama pola dengan PayDebtDialogTrigger di atas,
 * dipicu dari tombol Info di header.tsx lewat `setDetailOpen`. */
function ContactDetailDialogTrigger() {
  const { contact, detailOpen, setDetailOpen } = useContactCard();

  return (
    <ContactDetailDialog
      contactId={contact.contact_id}
      contactName={contact.contact_name}
      open={detailOpen}
      onOpenChange={setDetailOpen}
    />
  );
}
