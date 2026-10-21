"use client";

import { Card, CardContent } from "@/components/ui/card";
import { QueryState } from "@/components/query-state";
import { formatCurrency } from "@/lib/format-currency";
import { useThirdPartySummary } from "./use-third-party-summary";

export function ThirdPartySummaryList() {
  const { data: rows, isLoading, error } = useThirdPartySummary();

  if (isLoading || error) {
    return (
      <Card>
        <CardContent>
          <QueryState isLoading={isLoading} error={error} />
        </CardContent>
      </Card>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Belum ada titipan yang berjalan. Catat lewat tab "Data".
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((row) => (
            <li
              key={`${row.account_id}-${row.contact_id}`}
              className="flex items-center justify-between gap-2 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{row.contact_name}</p>
                <p className="text-muted-foreground text-xs">{row.account_name}</p>
              </div>
              <p className="font-medium">{formatCurrency(row.remaining, "IDR")}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
