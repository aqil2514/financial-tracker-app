"use client";

import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { DetailAdapterResult } from "../../types";

export function SourceDetailPanel({ detail }: { detail: DetailAdapterResult }) {
  return (
    <Collapsible className="rounded-lg border" defaultOpen>
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-muted/50">
        <div>
          <p className="text-muted-foreground text-xs">Data Asli Retailku</p>
          <p className="text-sm font-medium">{detail.amount}</p>
        </div>
        <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">
        <div className="space-y-2 p-3">
          {detail.note && <p className="text-sm">{detail.note}</p>}
          {detail.fields.length > 0 && (
            <dl className="divide-y rounded-lg border text-sm">
              {detail.fields.map((field, index) => (
                <div key={`${field.label}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-right font-medium">{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
