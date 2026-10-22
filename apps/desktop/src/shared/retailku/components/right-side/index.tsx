"use client";

import { useInnerRetailkuPicker } from "../context";
import { DUMMY_LIST_ITEMS } from "../left-side";
import { DetailView } from "./detail-view";

export function RightSide() {
  const { selectedItemId } = useInnerRetailkuPicker();
  const item = DUMMY_LIST_ITEMS.find((candidate) => candidate.id === selectedItemId) ?? null;

  return (
    <div className="overflow-y-auto p-4">
      {item ? (
        <DetailView item={item} />
      ) : (
        <p className="text-muted-foreground text-sm">Pilih salah satu data di sebelah kiri.</p>
      )}
    </div>
  );
}
