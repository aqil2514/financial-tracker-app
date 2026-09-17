"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import type { FilterConfig } from "../filter.interface";
import type {
  FilterPanelContextType,
  FilterPanelProviderProps,
} from "./panel.interface";

const FilterPanelContext = createContext<FilterPanelContextType>(
  {} as FilterPanelContextType
);

export function FilterPanelProvider({
  children,
  config,
  selectOptions = {},
  initialValue,
  onApplyFilter,
}: FilterPanelProviderProps) {
  const [snapshot, setSnapshot] = useState<FilterConfig[]>(initialValue);
  const [open, setOpen] = useState(false);

  const syncInit = useEffectEvent(() => {
    setSnapshot(initialValue);
  });

  useEffect(() => {
    if (open) syncInit();
  }, [open]);

  return (
    <FilterPanelContext.Provider
      value={{
        config,
        selectOptions,
        snapshot,
        setSnapshot,
        activeValue: initialValue,
        open,
        setOpen,
        onApplyFilter,
      }}
    >
      {children}
    </FilterPanelContext.Provider>
  );
}

export const useFilterPanel = () => useContext(FilterPanelContext);
