"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

export function CashflowChildrenFilter({
  options,
  value,
  allLabel,
  allTotal,
  onChange,
}: {
  options: { value: string; label: string; total: number }[];
  value: string | null;
  allLabel: string;
  allTotal: number;
  onChange: (value: string | null) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="divide-y pr-3">
        <ChildRow
          label={allLabel}
          total={allTotal}
          active={value === null}
          onClick={() => onChange(null)}
        />
        {options.map((option) => (
          <ChildRow
            key={option.value}
            label={option.label}
            total={option.total}
            active={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ChildRow({
  label,
  total,
  active,
  onClick,
}: {
  label: string;
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-md px-1 py-2 text-left text-sm transition-colors",
        active ? "bg-muted font-medium" : "hover:bg-muted/50"
      )}
    >
      <span>{label}</span>
      <span className="text-muted-foreground">{formatCurrency(total, "IDR")}</span>
    </button>
  );
}
