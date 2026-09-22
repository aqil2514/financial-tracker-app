"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useCalendar } from "../context";
import { CalendarSummaryHeader } from "./calendar-summary-header";
import { DayButtonWithSummary } from "./calendar-day-button";

export function CalendarCardContent() {
  const { selectedDate, onSelectedDateChange, month, setMonth } = useCalendar();

  return (
    <CardContent className="space-y-3">
      <CalendarSummaryHeader />

      <TooltipProvider delay={200}>
        <Calendar
          mode="single"
          locale={id}
          captionLayout="dropdown"
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
  );
}
