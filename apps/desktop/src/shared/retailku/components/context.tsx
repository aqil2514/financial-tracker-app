"use client";

import { createContext, useContext, useState } from "react";
import type { DateRange } from "react-day-picker";

import { useRetailkuMcpClient, type RetailkuMcpClientState } from "../hooks/use-retailku-mcp-client";

export type RetailkuPickerStep = "browse" | "map";

type InnerRetailkuPickerContextType = RetailkuMcpClientState & {
  step: RetailkuPickerStep;
  goToMapStep: () => void;
  goToBrowseStep: () => void;
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
};

const InnerRetailkuPickerContext = createContext<InnerRetailkuPickerContextType | undefined>(undefined);

export function InnerRetailkuPickerProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<RetailkuPickerStep>("browse");
  const [selectedTool, setSelectedToolState] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const mcpClient = useRetailkuMcpClient();

  function setSelectedTool(tool: string | null) {
    setSelectedToolState(tool);
    setSelectedItemId(null);
  }

  return (
    <InnerRetailkuPickerContext.Provider
      value={{
        ...mcpClient,
        step,
        goToMapStep: () => setStep("map"),
        goToBrowseStep: () => setStep("browse"),
        selectedTool,
        setSelectedTool,
        dateRange,
        setDateRange,
        selectedItemId,
        setSelectedItemId,
      }}
    >
      {children}
    </InnerRetailkuPickerContext.Provider>
  );
}

export function useInnerRetailkuPicker() {
  const context = useContext(InnerRetailkuPickerContext);
  if (!context) {
    throw new Error("useInnerRetailkuPicker must be used within InnerRetailkuPickerProvider");
  }
  return context;
}
