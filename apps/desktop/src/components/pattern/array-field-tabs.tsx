"use client";

import { useMemo, useState } from "react";

import { Tabs, TabsContent } from "@/components/ui/tabs";

export interface ArrayFieldTabItem {
  id: string;
}

interface ArrayFieldTabsProps<T extends ArrayFieldTabItem> {
  items: T[];
  renderContent: (item: T, index: number) => React.ReactNode;
  emptyFallback?: React.ReactNode;
  /** Tab aktif dikontrol dari luar (mis. diklik dari panel overview di
   * luar komponen ini) — kalau diisi, `onActiveChange` WAJIB juga
   * diisi. Kalau tidak diisi, komponen kelola tab aktifnya sendiri
   * (default, cocok untuk pemakaian mandiri tanpa overview). */
  activeId?: string;
  onActiveChange?: (id: string) => void;
}

/** Tampilkan satu item aktif dari sebuah daftar, tanpa navigasi tab
 * sendiri — navigasinya dikontrol dari luar via `activeId`/`onActiveChange`. */
export function ArrayFieldTabs<T extends ArrayFieldTabItem>({
  items,
  renderContent,
  emptyFallback,
  activeId,
  onActiveChange,
}: ArrayFieldTabsProps<T>) {
  const [internalActiveTab, setInternalActiveTab] = useState<string | null>(null);
  const isControlled = activeId !== undefined;
  const activeTab = isControlled ? activeId : internalActiveTab;

  const activeTabValue = useMemo(() => {
    if (activeTab && items.some((item) => item.id === activeTab)) {
      return activeTab;
    }
    return items[0]?.id;
  }, [activeTab, items]);

  function handleActiveChange(id: string) {
    if (!isControlled) setInternalActiveTab(id);
    onActiveChange?.(id);
  }

  if (items.length === 0) {
    return emptyFallback;
  }

  return (
    <Tabs value={activeTabValue} onValueChange={handleActiveChange} className="w-full min-w-0">
      {items.map((item, index) => (
        <TabsContent key={item.id} value={item.id} className="space-y-4">
          {renderContent(item, index)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
