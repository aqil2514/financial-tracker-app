"use client";

import { PeriodPicker } from "@/components/query/period-picker";
import { useInnerRetailkuPicker } from "../context";
import { ResultList } from "./result-list";
import { ToolPicker } from "./tool-picker";

export { type RetailkuPickerListItem, DUMMY_LIST_ITEMS } from "./result-list";

export function LeftSide() {
  const { selectedTool, setSelectedTool, dateRange, setDateRange, selectedItemId, setSelectedItemId } =
    useInnerRetailkuPicker();

  return (
    <div className="grid grid-rows-[auto_auto_1fr] gap-3 overflow-hidden p-4">
      <ToolPicker value={selectedTool} onChange={setSelectedTool} />
      <PeriodPicker value={dateRange} onChange={setDateRange} className="w-full" />

      {selectedTool ? (
        <ResultList selectedId={selectedItemId} onSelect={setSelectedItemId} />
      ) : (
        <p className="text-muted-foreground text-sm">Pilih tools dulu untuk melihat daftar data.</p>
      )}
    </div>
  );
}
