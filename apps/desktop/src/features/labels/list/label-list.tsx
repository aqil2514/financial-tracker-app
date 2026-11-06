"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/query-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLabelList, type LabelWithUsage } from "@/shared/labels/use-label-list";
import { LABEL_SCOPE_TEXT } from "../form/label.schema";
import { LabelEditDialog } from "../form/label-edit-dialog";
import { DeleteLabelDialog } from "./delete-label-dialog";

function usageText(label: LabelWithUsage) {
  const total = label.transaction_count + label.category_count + label.account_count;
  return total === 0 ? "Belum dipakai" : `Dipakai di ${total} data`;
}

export function LabelList() {
  const { data: labels, isLoading, error } = useLabelList();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return labels;
    return labels?.filter((label) => label.name.toLowerCase().includes(search.toLowerCase()));
  }, [labels, search]);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Cari label..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-56"
      />

      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-4">
          {filtered?.map((label) => (
            <div key={label.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{label.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{LABEL_SCOPE_TEXT[label.scope]}</Badge>
                  <span className="text-muted-foreground text-xs">{usageText(label)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <LabelEditDialog label={label} />
                <DeleteLabelDialog label={label} />
              </div>
            </div>
          ))}
          {filtered && filtered.length === 0 && labels && labels.length > 0 && (
            <p className="text-muted-foreground text-sm">Tidak ada label yang cocok dengan pencarian.</p>
          )}
          {labels && labels.length === 0 && (
            <p className="text-muted-foreground text-sm">Belum ada label. Tambahkan lewat tombol di atas.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
