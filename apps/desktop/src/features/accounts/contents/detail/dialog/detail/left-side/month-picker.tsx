"use client";

import { addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_LOCALE } from "@/lib/locale";
import { useAccountDetail } from "../detail-context";

/** Navigasi bulan ringkas ("< Sep 2026 >") — versi sederhana dari
 * period-picker penuh (preset/custom-range), cukup untuk chart 1-bulan
 * di ruang kecil dialog ini. Period picker lengkap ada di halaman Laporan. */
export function MonthPicker() {
  const { selectedMonth, setSelectedMonth } = useAccountDetail();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium">
        {new Intl.DateTimeFormat(APP_LOCALE, { month: "short", year: "numeric" }).format(
          selectedMonth
        )}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
