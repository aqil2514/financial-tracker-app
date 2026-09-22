"use client";

import { Card } from "@/components/ui/card";
import { CalendarProvider } from "./context";
import { CalendarCardHeader } from "./header";
import { CalendarCardContent } from "./content";

export function TransactionCalendarPanel() {
  return (
    <CalendarProvider>
      <Card>
        <CalendarCardHeader />
        <CalendarCardContent />
      </Card>
    </CalendarProvider>
  );
}

export { useTransactionDays, transactionDaysQueryKey } from "../../shared/hooks/use-transaction-days";
export { useMonthSummary, monthSummaryQueryKey } from "../../shared/hooks/use-month-summary";
