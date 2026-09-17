"use client";

import { ListFilter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { FilterConfig } from "../filter.interface";
import { FilterPanelContent } from "./content";
import { FilterPanelFooter } from "./footer";
import type { FilterKeyOption, SelectOptionsMap } from "./panel.interface";
import { FilterPanelProvider, useFilterPanel } from "./provider";

interface FilterPanelProps {
  config: FilterKeyOption[];
  selectOptions?: SelectOptionsMap;
  initialValue: FilterConfig[];
  onApplyFilter: (state: FilterConfig[]) => void;
}

export function FilterPanel({
  config,
  selectOptions,
  initialValue,
  onApplyFilter,
}: FilterPanelProps) {
  if (config.length < 1) {
    console.warn("[FilterPanel] config minimal 1 item.");
    return null;
  }

  return (
    <FilterPanelProvider
      config={config}
      selectOptions={selectOptions}
      initialValue={initialValue}
      onApplyFilter={onApplyFilter}
    >
      <FilterPanelInner />
    </FilterPanelProvider>
  );
}

function FilterPanelInner() {
  const { open, setOpen, snapshot, activeValue } = useFilterPanel();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <ListFilter className="size-4" />
        Filter
        {activeValue.length > 0 && (
          <Badge variant="secondary">{activeValue.length}</Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-3xl space-y-4 sm:w-xl">
        <p className="text-lg font-semibold">Filter Data</p>
        <p className="text-muted-foreground text-xs font-semibold">
          {snapshot.length === 0
            ? "Belum ada filter"
            : `Terdapat ${snapshot.length} filter`}
        </p>
        <Separator />
        <FilterPanelContent />
        <FilterPanelFooter />
      </PopoverContent>
    </Popover>
  );
}
