import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { formatCurrency } from "@/lib/format-currency";
import { getDebtReceivableEvents } from "../helpers/tools/get_debt_receivable_events";
import type { RetailkuDebtReceivableEvent } from "../types/tools/get_debt_receivable_events";
import type { RetailkuPackageEntry, RetailkuSummaryToolEntry, RetailkuToolDateRange } from "./types";

function toLocalDateTimeInputValue(iso: string) {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const TYPE_LABEL: Record<RetailkuDebtReceivableEvent["type"], string> = {
  RECEIVABLE: "Piutang",
  PAYABLE: "Utang",
};

function toEventPackage(event: RetailkuDebtReceivableEvent): RetailkuPackageEntry {
  const date = toLocalDateTimeInputValue(event.date);
  const typeLabel = TYPE_LABEL[event.type];

  if (event.kind === "ISSUED") {
    return {
      id: event.id,
      label: `${typeLabel} Baru — ${event.description} (${formatCurrency(event.amount, "IDR")})`,
      target: "transaction",
      defaultValues: {
        type: "transfer",
        amount: event.amount,
        // Akun kas & akun debt lokal TIDAK bisa diprefill — event Retailku ini tidak
        // membawa referensi akun manapun (beda dari Fund Transfer/Investasi yang punya
        // ID akun Retailku eksplisit), wajib dipilih manual oleh user di form.
        note: `${event.source} — ${event.description}`,
        date,
        contact_name: event.partyName,
      },
    };
  }

  // kind === "SETTLED"
  const relatedNote = event.relatedDocumentNumber ? ` (melunasi ${event.relatedDocumentNumber})` : "";

  return {
    id: event.id,
    label: `Pelunasan ${typeLabel} — ${event.description} (${formatCurrency(event.amount, "IDR")})`,
    target: "transaction",
    defaultValues: {
      type: "transfer",
      amount: event.amount,
      // Sama seperti ISSUED, akun tetap manual. `settle_debt_ids` SENGAJA tidak diisi —
      // ID debt Retailku tidak match ID `debts` lokal, dan daftar debt ongoing lokal
      // (`useOngoingDebts`) baru termuat setelah `contact_name` ter-resolve ke
      // `contact_id` di form. User mencentang manual debt lokal yang sesuai.
      note: `${event.source} — ${event.description}${relatedNote}`,
      date,
      contact_name: event.partyName,
    },
  };
}

async function fetchAllDebtReceivableEvents(client: Client, range: RetailkuToolDateRange) {
  const events: RetailkuDebtReceivableEvent[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await getDebtReceivableEvents(client, { ...range, page, limit: 50 });
    totalPages = result.meta.pagination.totalPages;
    events.push(...result.data);
    page += 1;
  } while (page <= totalPages);

  return events;
}

export const getDebtReceivableEventsEntry: RetailkuSummaryToolEntry = {
  mode: "summary",
  label: "Utang-Piutang (Kejadian)",
  fetchSummary: async (client, range) => {
    const events = await fetchAllDebtReceivableEvents(client, range);
    return events.map(toEventPackage);
  },
};
