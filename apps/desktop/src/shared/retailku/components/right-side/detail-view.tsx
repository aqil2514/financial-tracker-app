"use client";

import type { DetailAdapterResult } from "../../types";

export function DetailView({ label, detail }: { label: string; detail: DetailAdapterResult }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-2xl font-semibold">{detail.amount}</p>
        {detail.note && <p className="text-sm">{detail.note}</p>}
      </div>

      {detail.fields.length > 0 && (
        <dl className="divide-y rounded-lg border text-sm">
          {detail.fields.map((field) => (
            <div key={field.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="font-medium">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
