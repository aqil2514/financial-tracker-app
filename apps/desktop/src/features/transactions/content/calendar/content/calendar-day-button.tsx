"use client";

import { format } from "date-fns";
import type { DayButtonProps } from "react-day-picker";

import { CalendarDayButton } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumberCompact } from "@/lib/format";
import { formatCurrency } from "@/lib/format-currency";
import { useCalendar } from "../context";

export function DayButtonWithSummary(props: DayButtonProps) {
  const { transactionDays } = useCalendar();

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
            <p className="text-green-400">Pemasukan: {formatCurrency(summary.income, "IDR")}</p>
            <p className="text-red-400">Pengeluaran: {formatCurrency(summary.expense, "IDR")}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
