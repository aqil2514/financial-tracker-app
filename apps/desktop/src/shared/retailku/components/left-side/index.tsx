"use client";

import { PeriodPicker } from "@/components/query/period-picker";
import { RETAILKU_TOOLS } from "../../registry";
import { useInnerRetailkuPicker } from "../context";
import { ResultList } from "./result-list";
import { ToolPicker } from "./tool-picker";

export function LeftSide() {
  const { selectedTool, setSelectedTool, dateRange, setDateRange, selectedItemId, setSelectedItemId } =
    useInnerRetailkuPicker();
  const tool = selectedTool ? RETAILKU_TOOLS[selectedTool] : undefined;
  const isItemMode = tool && tool.mode !== "summary";

  return (
    <div className="grid grid-rows-[auto_auto_1fr] gap-3 overflow-hidden p-4">
      <ToolPicker value={selectedTool} onChange={setSelectedTool} />
      <PeriodPicker value={dateRange} onChange={setDateRange} className="w-full" />

      {!selectedTool ? (
        <p className="text-muted-foreground text-sm">Pilih tools dulu untuk melihat daftar data.</p>
      ) : isItemMode ? (
        <ResultList tool={tool} selectedId={selectedItemId} onSelect={setSelectedItemId} />
      ) : (
        <p className="text-muted-foreground text-sm">
          Tool ini merangkum seluruh data dalam rentang tanggal — lihat panel kanan.
        </p>
      )}
    </div>
  );
}
