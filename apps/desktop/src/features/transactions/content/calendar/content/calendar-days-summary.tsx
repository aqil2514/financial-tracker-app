"use client";

import { useCalendar } from "../context";

export function CalendarDaysSummary() {
  const { surplusDays, deficitDays } = useCalendar();

  if (surplusDays === 0 && deficitDays === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border p-2 text-center">
      <div>
        <p className="text-muted-foreground text-[10px]">Hari Surplus</p>
        <p className="text-xs font-medium text-green-600">{surplusDays} hari</p>
      </div>
      <div>
        <p className="text-muted-foreground text-[10px]">Hari Defisit</p>
        <p className="text-xs font-medium text-red-600">{deficitDays} hari</p>
      </div>
    </div>
  );
}
