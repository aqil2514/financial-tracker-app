"use client";

import { RETAILKU_TOOLS } from "../../registry";
import { useInnerRetailkuPicker } from "../context";
import { ItemPanel } from "./item-panel";
import { SummaryPanel } from "./summary-panel";

export function RightSide() {
  const { selectedTool } = useInnerRetailkuPicker();
  const tool = selectedTool ? RETAILKU_TOOLS[selectedTool] : undefined;

  if (!tool) return null;
  if (tool.mode === "summary") return <SummaryPanel tool={tool} />;
  return <ItemPanel tool={tool} />;
}
