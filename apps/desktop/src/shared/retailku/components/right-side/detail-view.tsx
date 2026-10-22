"use client";

import type { RetailkuPickerListItem } from "../left-side";

export function DetailView({ item }: { item: RetailkuPickerListItem }) {
  const fields = [
    { label: "Tanggal", value: item.date },
    { label: "Status", value: item.status },
    { label: "Dari Akun", value: item.fromAccount },
    { label: "Ke Akun", value: item.toAccount },
    { label: "Biaya Admin", value: item.fee },
  ].filter((field) => field.value);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground text-xs">{item.label}</p>
        <p className="text-2xl font-semibold">{item.amount ?? item.description}</p>
        {item.note && <p className="text-sm">{item.note}</p>}
      </div>

      {fields.length > 0 && (
        <dl className="divide-y rounded-lg border text-sm">
          {fields.map((field) => (
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
