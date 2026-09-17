"use client";

import { formatNumberCompact } from "@/lib/format";
import { useCalendar } from "./calendar-context";

export function CalendarSummaryHeader() {
  const { monthSummary, net } = useCalendar();

  if (!monthSummary) return null;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-lg border p-2 text-center">
      <div>
        <p className="text-muted-foreground text-[10px]">Pendapatan</p>
        <p className="text-xs font-medium text-green-600">
          {formatNumberCompact(monthSummary.income)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px]">Pengeluaran</p>
        <p className="text-xs font-medium text-red-600">
          {formatNumberCompact(monthSummary.expense)}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px]">Total</p>
        <p className={`text-xs font-medium ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatNumberCompact(net)}
        </p>
      </div>
    </div>
  );
}
