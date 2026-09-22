"use client";

import { QueryState } from "@/components/query-state";
import { useDebtsPage } from "./page";
import { ContactCard } from "./card";
import { findOldestOngoing } from "./utils";

/** Grid card per kontak, menggantikan tabel datar — pola diadaptasi dari
 * halaman "Utang Piutang" Retailku (card per pihak, metrik Aktif/
 * Terbayar/Belum Dibayar). Beda dari Retailku yang pecah 1 pihak jadi 2
 * card kalau punya piutang & utang sekaligus, di sini TETAP 1 card per
 * kontak dengan 2 section terpisah — supaya "Budi pernah dipinjami DAN
 * pernah meminjamkan" tidak muncul sebagai 2 identitas berbeda di grid.
 *
 * Data diambil dari `useDebtsPage()` (context level halaman, lihat
 * features/debts/page/debts-page-context.tsx) — bukan fetch sendiri. */
export function ContactSummaryCard() {
  const { summary, isLoading, receivables, payables } = useDebtsPage();

  if (isLoading) {
    return <QueryState isLoading={isLoading} />;
  }

  if (!summary || summary.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada kontak yang punya piutang/utang tercatat.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summary.map((contact) => (
        <ContactCard
          key={contact.contact_id}
          contact={contact}
          oldestReceivable={findOldestOngoing(receivables, contact.contact_id)}
          oldestPayable={findOldestOngoing(payables, contact.contact_id)}
        />
      ))}
    </div>
  );
}
