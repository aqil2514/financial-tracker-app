"use client";

import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { RETAILKU_TOOLS } from "../../registry";
import { useInnerRetailkuPicker } from "../context";
import { DetailView } from "./detail-view";

export function RightSide() {
  const { client, status, selectedTool, dateRange, selectedItemId, goToMapStep } = useInnerRetailkuPicker();
  const tool = selectedTool ? RETAILKU_TOOLS[selectedTool] : undefined;
  const range = dateRange?.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : null;

  const { data: items } = useQuery({
    queryKey: ["retailku-picker-list", selectedTool, range?.from, range?.to],
    queryFn: () =>
      tool!.fetchList(client!, {
        dateFrom: format(range!.from, "yyyy-MM-dd"),
        dateTo: format(range!.to, "yyyy-MM-dd"),
      }),
    enabled: status === "ready" && !!tool && !!range,
  });

  const item = items?.find((candidate) => candidate.id === selectedItemId) ?? null;

  const {
    data: detailRaw,
    isPending: isDetailPending,
    isError: isDetailError,
  } = useQuery({
    queryKey: ["retailku-picker-detail", selectedTool, selectedItemId],
    queryFn: () => tool!.fetchDetail(client!, selectedItemId!),
    enabled: status === "ready" && !!tool && !!selectedItemId,
  });

  const detail = detailRaw && tool ? tool.adapter(detailRaw) : null;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        {!item ? (
          <p className="text-muted-foreground text-sm">Pilih salah satu data di sebelah kiri.</p>
        ) : isDetailPending ? (
          <p className="text-muted-foreground text-sm">Memuat detail...</p>
        ) : isDetailError ? (
          <p className="text-destructive text-sm">Gagal memuat detail data ini.</p>
        ) : detail ? (
          <DetailView label={item.label} detail={detail} />
        ) : (
          <p className="text-muted-foreground text-sm">Detail belum tersedia untuk data ini.</p>
        )}
      </div>
      {detail && (
        <div className="border-t p-4">
          <Button type="button" className="w-full" onClick={goToMapStep}>
            Pakai Data Ini
          </Button>
        </div>
      )}
    </div>
  );
}
