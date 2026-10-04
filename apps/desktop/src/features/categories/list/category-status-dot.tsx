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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleActive.mutate(category);
            }}
            disabled={toggleActive.isPending}
            className={cn(
              "size-2.5 shrink-0 rounded-full transition-colors",
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
