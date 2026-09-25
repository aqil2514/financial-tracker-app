"use client";

import { useMemo, useState } from "react";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

/**
 * Versi generik `array-field-tabs.tsx` (retail-multitenant) TANPA
 * ketergantungan react-hook-form/useFieldArray — dipakai untuk daftar
 * yang sumbernya BUKAN array yang user tambah/hapus manual (di sini:
 * `key` mapping yang datang dari hasil MCP), jadi tidak ada
 * append/remove/defaultItem. Label tab SELALU nomor urut (`index + 1`),
 * sama seperti `ScrollableTabsTrigger` asli — detail "jenis apa" ada di
 * panel overview di luar komponen ini (lihat mapping-preview-panel.tsx),
 * bukan di label tab, supaya tab tetap ringkas walau daftarnya panjang.
 * Versi berbasis react-hook-form (kalau dibutuhkan alur append/remove
 * sungguhan) menyusul terpisah nanti.
 */
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
      <ScrollArea className="w-full min-w-0 whitespace-nowrap rounded-md">
        <TabsList className="w-max">
          {items.map((item, index) => (
            <TabsTrigger key={item.id} value={item.id} className="px-3">
              {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {items.map((item, index) => (
        <TabsContent key={item.id} value={item.id} className="space-y-4">
          {renderContent(item, index)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
