"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfToday,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PickerMode = "single" | "range";
type PresetGroupKey = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
type StepUnit = "day" | "week" | "month" | "quarter" | "year";
type PresetId =
  | "today"
  | "yesterday"
  | "last7Days"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "last3Months"
  | "thisQuarter"
  | "lastQuarter"
  | "yearToDate"
  | "lastYear"
  | "allTime";

interface PresetItem {
  id: PresetId;
  label: string;
  stepUnit: StepUnit;
  getRange: (anchor: Date, allTimeFrom: Date) => DateRange;
}

export interface PeriodPickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
  allTimeFrom?: Date;
  disabled?: boolean;
}

const tabItems: Array<{ value: PresetGroupKey; label: string }> = [
  { value: "daily", label: "Hari" },
  { value: "weekly", label: "Minggu" },
  { value: "monthly", label: "Bulan" },
  { value: "quarterly", label: "Kuartal" },
  { value: "yearly", label: "Tahun" },
];

const presetGroups: Record<PresetGroupKey, PresetItem[]> = {
  daily: [
    {
      id: "today",
      label: "Hari Ini",
      stepUnit: "day",
      getRange: (anchor) => ({ from: anchor, to: anchor }),
    },
    {
      id: "yesterday",
      label: "Kemarin",
      stepUnit: "day",
      getRange: (anchor) => {
        const day = subDays(anchor, 1);
        return { from: day, to: day };
      },
    },
    {
      id: "last7Days",
      label: "7 Hari Terakhir",
      stepUnit: "week",
      getRange: (anchor) => ({ from: subDays(anchor, 6), to: anchor }),
    },
  ],
  weekly: [
    {
      id: "thisWeek",
      label: "Minggu Ini",
      stepUnit: "week",
      getRange: (anchor) => ({ from: startOfWeek(anchor), to: endOfWeek(anchor) }),
    },
    {
      id: "lastWeek",
      label: "Minggu Lalu",
      stepUnit: "week",
      getRange: (anchor) => {
        const week = subWeeks(anchor, 1);
        return { from: startOfWeek(week), to: endOfWeek(week) };
      },
    },
  ],
  monthly: [
    {
      id: "thisMonth",
      label: "Bulan Ini",
      stepUnit: "month",
      getRange: (anchor) => ({ from: startOfMonth(anchor), to: endOfMonth(anchor) }),
    },
    {
      id: "lastMonth",
      label: "Bulan Lalu",
      stepUnit: "month",
      getRange: (anchor) => {
        const month = subMonths(anchor, 1);
        return { from: startOfMonth(month), to: endOfMonth(month) };
      },
    },
    {
      id: "last3Months",
      label: "3 Bulan Terakhir",
      stepUnit: "month",
      getRange: (anchor) => ({
        from: startOfMonth(subMonths(anchor, 2)),
        to: endOfMonth(anchor),
      }),
    },
  ],
  quarterly: [
    {
      id: "thisQuarter",
      label: "Kuartal Ini",
      stepUnit: "quarter",
      getRange: (anchor) => ({ from: startOfQuarter(anchor), to: endOfQuarter(anchor) }),
    },
    {
      id: "lastQuarter",
      label: "Kuartal Lalu",
      stepUnit: "quarter",
      getRange: (anchor) => {
        const quarter = subQuarters(anchor, 1);
        return { from: startOfQuarter(quarter), to: endOfQuarter(quarter) };
      },
    },
  ],
  yearly: [
    {
      id: "yearToDate",
      label: "Tahun Ini (YTD)",
      stepUnit: "year",
      getRange: (anchor) => ({ from: startOfYear(anchor), to: anchor }),
    },
    {
      id: "lastYear",
      label: "Tahun Lalu",
      stepUnit: "year",
      getRange: (anchor) => {
        const year = subYears(anchor, 1);
        return { from: startOfYear(year), to: endOfYear(year) };
      },
    },
    {
      id: "allTime",
      label: "Seluruh Waktu",
      stepUnit: "year",
      getRange: (anchor, allTimeFrom) => ({ from: allTimeFrom, to: endOfYear(anchor) }),
    },
  ],
};

function normalizeRange(range: DateRange | undefined) {
  if (!range?.from || !range.to) return undefined;
  return {
    from: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate()),
    to: new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate()),
  };
}

function isSameRange(left: DateRange | undefined, right: DateRange | undefined) {
  const normalizedLeft = normalizeRange(left);
  const normalizedRight = normalizeRange(right);

  if (!normalizedLeft || !normalizedRight) return false;

  return (
    normalizedLeft.from.getTime() === normalizedRight.from.getTime() &&
    normalizedLeft.to.getTime() === normalizedRight.to.getTime()
  );
}

function shiftDateByUnit(date: Date, stepUnit: StepUnit, direction: 1 | -1) {
  if (stepUnit === "day") return direction === 1 ? addDays(date, 1) : subDays(date, 1);
  if (stepUnit === "week") return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
  if (stepUnit === "month") return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
  if (stepUnit === "quarter") return direction === 1 ? addQuarters(date, 1) : subQuarters(date, 1);
  return direction === 1 ? addYears(date, 1) : subYears(date, 1);
}

function formatRangeLabel(date: DateRange | undefined, placeholder: string, mode: PickerMode) {
  if (!date?.from) return placeholder;
  if (mode === "single") return format(date.from, "dd MMM yyyy");
  if (!date.to) return format(date.from, "dd MMM yyyy");
  return `${format(date.from, "dd MMM yyyy")} - ${format(date.to, "dd MMM yyyy")}`;
}

/**
 * Date-range picker dengan preset (Hari/Minggu/Bulan/Kuartal/Tahun) +
 * navigasi geser periode maju-mundur + kalender kustom (tunggal/rentang)
 * — diadaptasi dari `_shared/molecules/period-picker.tsx` di
 * `retail-multitenant` (logic preset/navigasi 1:1 sama), JSX-nya disusun
 * ulang untuk primitif `@base-ui/react` yang dipakai `components/ui/popover`
 * dan `components/ui/tabs` di sini (beda dari Radix di proyek asal — mis.
 * `PopoverContent` di sini TIDAK punya prop `collisionPadding`).
 *
 * Konsumsi hasilnya (`DateRange`): konversi ke `{ from, to }` string
 * "yyyy-MM-dd" lalu diteruskan sebagai kondisi `date(date) BETWEEN $1
 * AND $2` — LEWAT JALUR TERPISAH dari sistem `FilterConfig[]`/
 * `buildWhereClause` generik di `components/query/filters/`, karena
 * kolom `transactions.date` bertipe datetime (bukan cuma tanggal) dan
 * `buildWhereClause` tidak membungkus `date(...)` otomatis untuk field
 * biasa. Contoh nyata: `features/transactions/content/list/context/hooks/use-list-filter.ts`
 * (`dateRange`/`setDateRange`) dan `use-transactions/build-where-conditions.ts`
 * (`dateRangeCondition`), dipakai `features/account-detail/header/index.tsx`.
 */
export function PeriodPicker({
  value,
  onChange,
  className,
  placeholder = "Pilih Periode",
  allTimeFrom = new Date(2000, 0, 1),
  disabled,
}: PeriodPickerProps) {
  const today = startOfToday();
  const isControlled = value !== undefined;

  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>(undefined);
  const [activeGroup, setActiveGroup] = React.useState<PresetGroupKey>("monthly");
  const [activePresetId, setActivePresetId] = React.useState<PresetId | null>(null);
  const [mode, setMode] = React.useState<PickerMode>("range");
  const [mobilePanel, setMobilePanel] = React.useState<"preset" | "custom">("preset");

  const date = isControlled ? value : internalDate;

  const activePreset = React.useMemo(
    () =>
      activePresetId
        ? (Object.values(presetGroups)
            .flat()
            .find((preset) => preset.id === activePresetId) ?? null)
        : null,
    [activePresetId]
  );

  const handleSelect = React.useCallback(
    (range: DateRange | undefined) => {
      if (!isControlled) setInternalDate(range);
      onChange?.(range);
    },
    [isControlled, onChange]
  );

  const applyPreset = React.useCallback(
    (group: PresetGroupKey, preset: PresetItem, anchor = today) => {
      setActiveGroup(group);
      setActivePresetId(preset.id);
      setMode("range");
      handleSelect(preset.getRange(anchor, allTimeFrom));
    },
    [allTimeFrom, handleSelect, today]
  );

  const shiftRange = React.useCallback(
    (direction: 1 | -1) => {
      if (!activePreset || !date?.from) return;
      const anchor = shiftDateByUnit(date.from, activePreset.stepUnit, direction);
      handleSelect(activePreset.getRange(anchor, allTimeFrom));
    },
    [activePreset, allTimeFrom, date, handleSelect]
  );

  const handleCalendarRangeSelect = React.useCallback(
    (range: DateRange | undefined) => {
      handleSelect(range);
      if (
        activePreset &&
        isSameRange(range, activePreset.getRange(range?.from ?? today, allTimeFrom))
      ) {
        return;
      }
      setActivePresetId(null);
    },
    [activePreset, allTimeFrom, handleSelect, today]
  );

  const handleCalendarSingleSelect = React.useCallback(
    (day: Date | undefined) => {
      if (!day) {
        handleSelect(undefined);
      } else {
        handleSelect({ from: day, to: day });
      }
      setActivePresetId(null);
    },
    [handleSelect]
  );

  const handleModeChange = (newMode: PickerMode) => {
    setMode(newMode);
    if (newMode === "single" && date?.from) {
      handleSelect({ from: date.from, to: date.from });
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={disabled || !activePreset || !date?.from}
        onClick={() => shiftRange(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-48 justify-start text-left font-normal sm:w-70",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />
              <span className="truncate">{formatRangeLabel(date, placeholder, mode)}</span>
            </Button>
          }
        />
        <PopoverContent className="w-[min(100vw-2rem,560px)] p-0" align="start">
          {/* Mobile: tab switcher Preset / Kustom */}
          <div className="flex border-b md:hidden">
            <button
              type="button"
              className={cn(
                "flex-1 py-2 text-xs font-semibold tracking-wider uppercase transition-colors",
                mobilePanel === "preset"
                  ? "border-primary text-primary border-b-2"
                  : "text-muted-foreground hover:bg-muted/30"
              )}
              onClick={() => setMobilePanel("preset")}
            >
              Preset
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 py-2 text-xs font-semibold tracking-wider uppercase transition-colors",
                mobilePanel === "custom"
                  ? "border-primary text-primary border-b-2"
                  : "text-muted-foreground hover:bg-muted/30"
              )}
              onClick={() => setMobilePanel("custom")}
            >
              Kustom
            </button>
          </div>

          <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
            {/* Panel preset — tampil di mobile hanya jika mobilePanel==="preset", selalu tampil di md+ */}
            <Tabs
              value={activeGroup}
              onValueChange={(value) => setActiveGroup(value as PresetGroupKey)}
              className={cn(
                "bg-muted/5 border-b md:border-r md:border-b-0",
                mobilePanel !== "preset" && "hidden md:block"
              )}
            >
              <div className="border-b p-3">
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="h-9 w-max min-w-full flex-nowrap justify-start gap-1 p-1">
                    {tabItems.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="shrink-0 text-[10px] tracking-wider uppercase"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>

              <ScrollArea className="max-h-80">
                <div className="p-2">
                  {Object.entries(presetGroups).map(([key, presets]) => (
                    <TabsContent key={key} value={key} className="mt-0">
                      <div className="space-y-1">
                        {presets.map((preset) => {
                          const presetRange = preset.getRange(today, allTimeFrom);
                          const isActive =
                            activePresetId === preset.id || isSameRange(date, presetRange);

                          return (
                            <Button
                              key={preset.id}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between px-3 py-4 text-sm font-normal hover:shadow-sm"
                              onClick={() => applyPreset(key as PresetGroupKey, preset)}
                            >
                              <span className={cn("transition-colors", isActive && "text-primary font-semibold")}>
                                {preset.label}
                              </span>
                              <ChevronRight className="size-3 opacity-30" />
                            </Button>
                          );
                        })}
                      </div>
                    </TabsContent>
                  ))}
                </div>
              </ScrollArea>
            </Tabs>

            {/* Panel kalender — tampil di mobile hanya jika mobilePanel==="custom", selalu tampil di md+ */}
            <div
              className={cn("flex min-w-0 flex-col", mobilePanel !== "custom" && "hidden md:flex")}
            >
              <div className="bg-background/50 flex items-center justify-between border-b px-4 py-3">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                  {mode === "single" ? "Pilih Tanggal" : "Kustom Rentang"}
                </h4>
                <div className="flex overflow-hidden rounded-md border text-xs">
                  <button
                    type="button"
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      mode === "single" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                    onClick={() => handleModeChange("single")}
                  >
                    Tunggal
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "border-l px-2.5 py-1 transition-colors",
                      mode === "range" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                    onClick={() => handleModeChange("range")}
                  >
                    Rentang
                  </button>
                </div>
              </div>
              <div className="p-2">
                {mode === "single" ? (
                  <Calendar
                    mode="single"
                    defaultMonth={date?.from}
                    selected={date?.from}
                    onSelect={handleCalendarSingleSelect}
                    numberOfMonths={1}
                    className="mx-auto rounded-md"
                  />
                ) : (
                  <Calendar
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={handleCalendarRangeSelect}
                    numberOfMonths={1}
                    className="mx-auto rounded-md"
                  />
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={disabled || !activePreset || !date?.from}
        onClick={() => shiftRange(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
