"use client";

import { Filter } from "./filter";
import { Sort } from "./sort";

export function Toolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Sort />
      <Filter />
    </div>
  );
}
