"use client";

import { createContext, useContext, useState } from "react";

import type { ContactDebtSummary } from "@/shared/debts/use-contact-summary";
import type { DebtListRow } from "@/shared/debts/use-debts-list";

interface ContactCardContextType {
  contact: ContactDebtSummary;
  oldestReceivable: DebtListRow | undefined;
  oldestPayable: DebtListRow | undefined;
  payingDebt: DebtListRow | null;
  setPayingDebt: (debt: DebtListRow | null) => void;
}

const ContactCardContext = createContext<ContactCardContextType | undefined>(undefined);

/** State satu `ContactCard` — pola sama dengan `AccountsProvider`
 * (features/accounts/sections/list/context/index.tsx): dialog
 * "Bayar" di-render SEKALI di `index.tsx`, bukan per section, baris
 * yang sedang dibayar (`payingDebt`) datang dari context, di-set lewat
 * `setPayingDebt()` dari tombol bayar di `body.tsx`. Section body jadi
 * tidak perlu tahu apa-apa soal state dialog. */
export function ContactCardProvider({
  contact,
  oldestReceivable,
  oldestPayable,
  children,
}: {
  contact: ContactDebtSummary;
  oldestReceivable: DebtListRow | undefined;
  oldestPayable: DebtListRow | undefined;
  children: React.ReactNode;
}) {
  const [payingDebt, setPayingDebt] = useState<DebtListRow | null>(null);

  return (
    <ContactCardContext.Provider
      value={{ contact, oldestReceivable, oldestPayable, payingDebt, setPayingDebt }}
    >
      {children}
    </ContactCardContext.Provider>
  );
}

export function useContactCard() {
  const context = useContext(ContactCardContext);
  if (!context) {
    throw new Error("useContactCard must be used within ContactCardProvider");
  }
  return context;
}
