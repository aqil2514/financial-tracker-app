"use client";

import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { useContactDebts, type ContactDebtRow } from "@/shared/debts/use-contact-debts";
import { DebtRow } from "./debt-row";

/** Total sepanjang waktu (SEMUA status, termasuk lunas/dihapuskan) —
 * beda dari agregat "aktif" di card ringkasan (ContactDebtSummary, cuma
 * hitung status ongoing) — dihitung di client dari hasil useContactDebts
 * yang sudah di-fetch buat daftar individual, bukan query SQL terpisah. */
function summarize(debts: ContactDebtRow[], type: "receivable" | "payable") {
  const filtered = debts.filter((debt) => debt.type === type);
  return {
    total: filtered.reduce((sum, debt) => sum + debt.amount, 0),
    remaining: filtered.reduce((sum, debt) => sum + debt.remaining, 0),
    count: filtered.length,
  };
}

export function ContactDetailContent({ contactId }: { contactId: number }) {
  const { data: debts, isLoading } = useContactDebts(contactId);

  if (isLoading || !debts) {
    return <QueryState isLoading={isLoading} />;
  }

  const receivableSummary = summarize(debts, "receivable");
  const payableSummary = summarize(debts, "payable");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <SummaryBlock label="Piutang (semua riwayat)" tone="receivable" {...receivableSummary} />
        <SummaryBlock label="Utang (semua riwayat)" tone="payable" {...payableSummary} />
      </div>

      {debts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Belum ada riwayat piutang/utang.</p>
      ) : (
        <div className="space-y-2">
          {debts.map((debt) => (
            <DebtRow key={debt.id} debt={debt} />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryBlock({
  label,
  total,
  remaining,
  count,
  tone,
}: {
  label: string;
  total: number;
  remaining: number;
  count: number;
  tone: "receivable" | "payable";
}) {
  const toneClass = tone === "receivable" ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-1 rounded-md border p-3">
      <p className="text-muted-foreground text-sm">
        {label} ({count})
      </p>
      <p className={`text-lg font-semibold ${toneClass}`}>{formatCurrency(total, "IDR")}</p>
      <p className="text-muted-foreground text-xs">
        Sisa belum dibayar: {formatCurrency(remaining, "IDR")}
      </p>
    </div>
  );
}
