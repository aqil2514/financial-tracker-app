"use client";

import { HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format-currency";
import { useContactCard } from "./context";

export function ContactCardBody() {
  const { contact, oldestReceivable, oldestPayable, setPayingDebt } = useContactCard();
  const hasReceivable = contact.receivable_active > 0;
  const hasPayable = contact.payable_active > 0;

  return (
    <CardContent className="space-y-4">
      <DebtSection
        label="Piutang"
        active={contact.receivable_active}
        paid={contact.receivable_paid}
        remaining={contact.receivable_remaining}
        tone="receivable"
        hasData={hasReceivable}
        payTooltip="Catat pelunasan piutang"
        onPay={oldestReceivable ? () => setPayingDebt(oldestReceivable) : undefined}
      />
      <div className="border-t" />
      <DebtSection
        label="Utang"
        active={contact.payable_active}
        paid={contact.payable_paid}
        remaining={contact.payable_remaining}
        tone="payable"
        hasData={hasPayable}
        payTooltip="Catat pembayaran utang"
        onPay={oldestPayable ? () => setPayingDebt(oldestPayable) : undefined}
      />
    </CardContent>
  );
}

/** Satu arah (Piutang ATAU Utang) — dipanggil 2x oleh `ContactCardBody`,
 * cuma relevan sebagai bagian dari body satu card, tidak dipanggil dari
 * tempat lain (lihat pola ItemInfo/ItemActions di
 * docs/rules/state-lifting-vs-context.md). */
function DebtSection({
  label,
  active,
  paid,
  remaining,
  tone,
  hasData,
  payTooltip,
  onPay,
}: {
  label: string;
  active: number;
  paid: number;
  remaining: number;
  tone: "receivable" | "payable";
  hasData: boolean;
  payTooltip: string;
  onPay: (() => void) | undefined;
}) {
  const toneClass = tone === "receivable" ? "text-green-600" : "text-red-600";

  if (!hasData) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-muted-foreground text-lg font-semibold">—</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">{label} Aktif</p>
          <p className={`font-medium ${toneClass}`}>{formatCurrency(active, "IDR")}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Terbayar</p>
          <p className="font-medium">{formatCurrency(paid, "IDR")}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <p className="text-muted-foreground text-sm">Belum Dibayar</p>
        <div className="flex items-center gap-2">
          <p className={`text-lg font-semibold ${toneClass}`}>{formatCurrency(remaining, "IDR")}</p>
          {onPay && (
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onPay} />}>
                <HandCoins />
              </TooltipTrigger>
              <TooltipContent>{payTooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
