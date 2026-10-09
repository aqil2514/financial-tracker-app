"use client";

import type { Category } from "@/lib/db";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";
import { useToggleCategoryActive } from "./use-toggle-category-active";

/** Dot indikator aktif/nonaktif yang clickable — dipakai di `CategoryCard`
 * maupun header accordion kategori induk, supaya keduanya bisa toggle
 * status tanpa buka dialog form. */
export function CategoryStatusDot({ category }: { category: Category }) {
  const toggleActive = useToggleCategoryActive();
  const isActive = category.is_active === 1;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          // `role="button"` + `<span>`, BUKAN `<button>` -- komponen ini
          // dipasang di dalam AccordionTrigger yang sendirinya sudah
          // <button> (lihat accordion.tsx), dan nested <button> invalid
          // di HTML (hydration error). base-ui tetap forward semua
          // interaction props (onClick/onKeyDown/dst) ke elemen apapun
          // yang di-render di sini, jadi tetap accessible.
          <span
            role="button"
            tabIndex={toggleActive.isPending ? -1 : 0}
            aria-disabled={toggleActive.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (toggleActive.isPending) return;
              toggleActive.mutate(category);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              if (toggleActive.isPending) return;
              toggleActive.mutate(category);
            }}
            className={cn(
              "size-2.5 shrink-0 rounded-full transition-colors",
              toggleActive.isPending ? "opacity-50" : "cursor-pointer",
              isActive ? "bg-emerald-500" : "bg-muted-foreground/30"
            )}
          />
        }
      />
      <TooltipContent>
        {isActive ? "Aktif — klik untuk nonaktifkan" : "Nonaktif — klik untuk aktifkan"}
      </TooltipContent>
    </Tooltip>
  );
}
