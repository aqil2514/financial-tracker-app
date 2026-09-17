"use client";

import { useState } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { DayButtonProps } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumberCompact, formatRupiah } from "@/lib/format";
import { useTransactionDays } from "./use-transaction-days";
import { useMonthSummary } from "./use-month-summary";

export function TransactionCalendarPanel({
  selectedDate,
  onSelectedDateChange,
}: {
  selectedDate: Date | undefined;
  onSelectedDateChange: (date: Date | undefined) => void;
}) {
  const [month, setMonth] = useState(new Date());
  const monthKey = format(month, "yyyy-MM");
  const { data: transactionDays } = useTransactionDays(monthKey);
  const { data: monthSummary } = useMonthSummary(monthKey);

  const net = (monthSummary?.income ?? 0) - (monthSummary?.expense ?? 0);

  function DayButtonWithSummary(props: DayButtonProps) {
    const dayKey = format(props.day.date, "yyyy-MM-dd");
    const summary = transactionDays?.get(dayKey);
    const isSelected = props.modifiers.selected;
    const dayNet = summary ? summary.income - summary.expense : 0;

    const dayButton = (
      <CalendarDayButton
        {...props}
        className={`${props.className ?? ""} h-auto flex-col justify-start gap-0.5 py-1`}
      >
        <span className="text-xs">{props.day.date.getDate()}</span>
        {summary && (
          <span
            className={`text-[9px] leading-tight font-medium ${
              isSelected
                ? "text-primary-foreground"
                : dayNet >= 0
                  ? "text-green-600"
                  : "text-red-600"
            }`}
          >
            {dayNet >= 0 ? "+" : ""}
            {formatNumberCompact(dayNet)}
          </span>
        )}
      </CalendarDayButton>
    );

    if (!summary) {
      return <div className="relative size-full">{dayButton}</div>;
    }

    return (
      <div className="relative size-full">
        <Tooltip>
          <TooltipTrigger render={dayButton} />
          <TooltipContent>
            <div className="space-y-0.5">
              <p className="text-green-400">
                Pemasukan: {formatRupiah(summary.income)}
              </p>
              <p className="text-red-400">
                Pengeluaran: {formatRupiah(summary.expense)}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Kalender</CardTitle>
        {selectedDate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectedDateChange(undefined)}
          >
            Reset
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {monthSummary && (
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
        )}

        <TooltipProvider delay={200}>
          <Calendar
            mode="single"
            locale={id}
            selected={selectedDate}
            onSelect={(date) =>
              onSelectedDateChange(
                selectedDate && date && format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
                  ? undefined
                  : date
              )
            }
            month={month}
            onMonthChange={setMonth}
            components={{ DayButton: DayButtonWithSummary }}
            className="w-full [--cell-size:--spacing(12)]"
            classNames={{
              root: "w-full",
              month: "w-full",
              month_grid: "w-full",
              week: "flex w-full justify-between",
              weekdays: "flex w-full justify-between",
            }}
          />
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
