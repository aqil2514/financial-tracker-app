"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCalendar } from "./calendar-context";

export function CalendarCardHeader() {
  const { selectedDate, onSelectedDateChange } = useCalendar();

  return (
    <CardHeader className="flex items-center justify-between">
      <CardTitle>Kalender</CardTitle>
      {selectedDate && (
        <Button variant="ghost" size="sm" onClick={() => onSelectedDateChange(undefined)}>
          Reset
        </Button>
      )}
    </CardHeader>
  );
}
