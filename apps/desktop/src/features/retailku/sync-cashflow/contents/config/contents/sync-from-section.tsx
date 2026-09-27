"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

import { PeriodPicker } from "@/components/query/period-picker";
import { useRetailkuSyncCashflowConfig } from "../context";

/** Section "Periode Sync" — rentang `from`-`to` untuk sync MANUAL,
 * murni draft di komponen (TIDAK persisten/disimpan, tidak ada
 * auto-advance) — user isi tiap kali mau sync/preview. Pilih 1
 * tanggal saja berarti sync HANYA untuk hari itu (bukan "sampai hari
 * ini", semantik lama itu hilang bersama auto-sync yang sudah
 * dihapus, lihat handover 2026-09-26). */
export function SyncFromSection() {
  const { syncFrom } = useRetailkuSyncCashflowConfig();
  const { range, setRange } = syncFrom;

  const pickerValue = useMemo<DateRange | undefined>(() => {
    if (!range.from) return undefined;
    return {
      from: new Date(`${range.from}T00:00`),
      to: new Date(`${range.to ?? range.from}T00:00`),
    };
  }, [range]);

  const handlePickerChange = (value: DateRange | undefined) => {
    if (!value?.from) {
      setRange({ from: "", to: null });
      return;
    }
    const from = format(value.from, "yyyy-MM-dd");
    const to = value.to ? format(value.to, "yyyy-MM-dd") : null;
    setRange({ from, to: to === from ? null : to });
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Periode Sync</h3>
      <p className="text-muted-foreground text-sm">
        Rentang tanggal yang diproses sync berikutnya. Pilih 1 tanggal saja untuk sync hari itu saja.
      </p>
      <PeriodPicker value={pickerValue} onChange={handlePickerChange} />
    </div>
  );
}
