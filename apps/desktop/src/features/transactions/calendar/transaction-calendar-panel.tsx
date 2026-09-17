"use client";

import { Card } from "@/components/ui/card";
import { CalendarProvider } from "./calendar-context";
import { CalendarCardHeader } from "./calendar-card-header";
import { CalendarCardContent } from "./calendar-card-content";

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
