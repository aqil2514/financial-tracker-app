"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_OPERATOR } from "./default-operator";
import { useFilterPanel } from "./provider";

export function FilterPanelFooter() {
  const { config, snapshot, setSnapshot, onApplyFilter, setOpen } =
    useFilterPanel();

  // Field yang belum dipakai di snapshot
  const usedKeys = snapshot.map((f) => f.filterKey);
  const nextConfig = config.find((c) => !usedKeys.includes(c.key));
  const allUsed = !nextConfig;

  const handleAdd = () => {
    if (!nextConfig) return;
    setSnapshot((prev) => [
      ...prev,
      {
        filterKey: nextConfig.key,
        filterOperator: DEFAULT_OPERATOR[nextConfig.type],
        filterValue: null,
      },
    ]);
  };

  const handleApply = () => {
    const validFilters = snapshot.filter((f) => f.filterKey !== "");
    onApplyFilter(validFilters);
    setOpen(false);
  };

  return (
    <div className="flex justify-between">
      <Button
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={allUsed}
      >
        Tambah Filter
      </Button>
      <Button variant="outline" size="sm" onClick={handleApply}>
        Terapkan Filter
      </Button>
    </div>
  );
}
