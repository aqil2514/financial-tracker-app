"use client";

import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { RetailkuItemToolEntry } from "../../registry/types";
import { useInnerRetailkuPicker } from "../context";

export function ResultList({
  tool,
  selectedId,
  onSelect,
}: {
  tool: RetailkuItemToolEntry;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { client, status, selectedTool, dateRange } = useInnerRetailkuPicker();
  const range = dateRange?.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : null;

  const { data: items, isPending, isError } = useQuery({
    queryKey: ["retailku-picker-list", selectedTool, range?.from, range?.to],
    queryFn: () =>
      tool.fetchList(client!, {
        dateFrom: format(range!.from, "yyyy-MM-dd"),
        dateTo: format(range!.to, "yyyy-MM-dd"),
      }),
    enabled: status === "ready" && !!range,
  });

  if (!range) {
    return <p className="text-muted-foreground text-sm">Pilih rentang tanggal dulu untuk melihat daftar data.</p>;
  }

  if (status === "error") {
    return <p className="text-destructive text-sm">Gagal terhubung ke Retailku.</p>;
  }

  if (status !== "ready" || isPending) {
    return <p className="text-muted-foreground text-sm">Memuat data...</p>;
  }

  if (isError) {
    return <p className="text-destructive text-sm">Gagal memuat data dari Retailku.</p>;
  }

  if (items && items.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada data pada rentang tanggal ini.</p>;
  }

  return (
    <ScrollArea className="min-h-0 rounded-lg border">
      <ul className="divide-y">
        {items?.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`hover:bg-accent flex w-full items-center justify-between gap-2 p-3 text-left text-sm ${
                selectedId === item.id ? "bg-accent" : ""
              }`}
            >
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
