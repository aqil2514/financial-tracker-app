"use client";

import { Toolbar } from "./toolbar";
import { CardGrid } from "./card-grid";

export function DebtsSummaryContent() {
  return (
    <div className="space-y-4">
      <Toolbar />
      <CardGrid />
    </div>
  );
}
